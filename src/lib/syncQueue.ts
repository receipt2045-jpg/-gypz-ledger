import type {
  AssetSnapshot,
  Categories,
  Confession,
  MonthlyLedger,
  OccasionEntry,
  Profile,
} from '../types'

// ── 저장 실패 재시도 큐 ────────────────────────
// 화면은 낙관적으로 먼저 바뀌므로, 서버 저장이 실패하면 사용자는 성공한 줄 안다.
// 실패분을 여기 담아뒀다가 연결이 돌아오면 다시 보낸다.
// (예전엔 고백만 큐가 있었고 정산·자산은 콘솔 로그로 끝나 조용히 사라졌다)

export type PendingOp =
  | { kind: 'ledger'; key: string; payload: MonthlyLedger }
  | { kind: 'snapshot'; key: string; payload: AssetSnapshot }
  | { kind: 'occasion'; key: string; payload: OccasionEntry }
  | { kind: 'occasionDelete'; key: string; payload: { id: string } }
  | { kind: 'profile'; key: string; payload: Profile }
  | { kind: 'categories'; key: string; payload: Categories }
  | { kind: 'aliases'; key: string; payload: Record<string, string> }
  | { kind: 'confession'; key: string; payload: Confession }
  | { kind: 'confessionDelete'; key: string; payload: { id: string } }

export const QUEUE_KEY = 'gypz-sync-queue'
const LEGACY_CONFESS_KEY = 'gypz-confess-queue'

/**
 * 큐에 op를 넣는다 (순수 함수 — 테스트 대상).
 * - 같은 key는 최신 것으로 교체한다. 오래된 상태를 나중에 replay 해서
 *   최신 저장을 되돌리는 사고를 막기 위함.
 * - 아직 못 보낸 경조사를 지우면 둘 다 무의미하므로 서로 상쇄시킨다.
 */
export function mergeOp(list: PendingOp[], op: PendingOp): PendingOp[] {
  if (op.kind === 'occasionDelete' || op.kind === 'confessionDelete') {
    const addKey = `${op.kind === 'occasionDelete' ? 'occasion' : 'confession'}:${op.payload.id}`
    const pendingAdd = list.some((o) => o.key === addKey)
    const without = list.filter((o) => o.key !== addKey)
    return pendingAdd ? without : [...without, op]
  }
  const idx = list.findIndex((o) => o.key === op.key)
  if (idx === -1) return [...list, op]
  const next = [...list]
  next[idx] = op // 순서는 유지하고 내용만 최신으로
  return next
}

function read(): PendingOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as PendingOp[]) : []
  } catch {
    return []
  }
}

function write(list: PendingOp[]) {
  if (list.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(list))
  else localStorage.removeItem(QUEUE_KEY)
  notify()
}

/** 예전 고백 전용 큐를 새 큐로 옮긴다 (한 번만) */
export function migrateLegacyQueue() {
  try {
    const raw = localStorage.getItem(LEGACY_CONFESS_KEY)
    if (!raw) return
    const olds = JSON.parse(raw) as Confession[]
    let list = read()
    for (const c of olds) {
      list = mergeOp(list, { kind: 'confession', key: `confession:${c.id}`, payload: c })
    }
    write(list)
    localStorage.removeItem(LEGACY_CONFESS_KEY)
  } catch {
    /* 손상된 값이면 그냥 버린다 */
  }
}

export function enqueue(op: PendingOp) {
  write(mergeOp(read(), op))
}

export function pendingCount(): number {
  return read().length
}

// ── 상태 구독 (UI 배너용) ──────────────────────
type Listener = () => void
const listeners = new Set<Listener>()

function notify() {
  for (const l of listeners) l()
}

export function subscribeSync(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}

/**
 * 큐를 순서대로 다시 보낸다. 하나라도 실패하면(=아직 연결 안 됨) 거기서 멈추고
 * 나머지는 남겨둔다. 반환값은 남은 건수.
 */
export async function flushQueue(
  householdId: string,
  send: (op: PendingOp, hid: string) => Promise<void>,
): Promise<number> {
  let list = read()
  while (list.length) {
    const op = list[0]
    try {
      await send(op, householdId)
    } catch {
      break // 연결이 아직 안 돌아옴 — 다음 기회에
    }
    list = list.slice(1)
    write(list)
  }
  return list.length
}
