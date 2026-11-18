import type {
  AssetSnapshot,
  Categories,
  Confession,
  MonthlyLedger,
  OccasionEntry,
  Profile,
} from '../types'
import type { CategoryChange } from './categoryChanges'

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
  // 예전(2026-10-07 전) 큐에 남아 있을 수 있는 '목록 통째' 저장 — 보낼 때 빠진 것만 더한다
  | { kind: 'categories'; key: string; payload: Categories }
  | { kind: 'categoryChange'; key: string; payload: CategoryChange }
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

/**
 * 같은 key를 바로 보내는 데 성공했으면 큐에 남은 옛 실패분은 버린다 (2026-11-17).
 * 안 버리면 다음에 앱을 열 때 옛 상태를 다시 보내 최신 저장을 되돌린다 — "지운 게 다시 살아나요".
 */
export function dropQueued(key: string) {
  const list = read()
  const next = list.filter((o) => o.key !== key)
  if (next.length !== list.length) write(next)
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
 *
 * 2026-11-19 점검: 보내는 동안에도 앱은 쓸 수 있다. 처음 읽은 목록 복사본으로 큐를 덮어쓰면
 * - 그사이 바로 저장에 성공해 지운 옛 실패분(dropQueued)이 되살아나 최신을 되돌리고
 * - 그사이 새로 실패해 넣은 저장은 사라졌다.
 * 그래서 매번 큐를 다시 읽고, 방금 보낸 것과 내용이 같은 한 건만 지운다.
 */
export async function flushQueue(
  householdId: string,
  send: (op: PendingOp, hid: string) => Promise<void>,
): Promise<number> {
  for (;;) {
    const op = read()[0]
    if (!op) return 0
    const sent = JSON.stringify(op)
    try {
      await send(op, householdId)
    } catch {
      return read().length // 연결이 아직 안 돌아옴 — 다음 기회에
    }
    const now = read()
    const i = now.findIndex((o) => JSON.stringify(o) === sent)
    // 보내는 사이 같은 key가 더 새 내용으로 바뀌었으면 그건 남겨 두고 다음 차례에 보낸다
    if (i !== -1) write([...now.slice(0, i), ...now.slice(i + 1)])
  }
}
