import { create } from 'zustand'
import type {
  AppData,
  AssetSnapshot,
  CategoryGroup,
  Confession,
  MonthlyLedger,
  OccasionEntry,
  Profile,
} from '../types'
import { DEFAULT_CATEGORIES, findCategoryGroup } from './constants'
import { genId } from './carryover'
import { YEAREND_SAVE_KEY } from './yearEndTax'
import { buildSeed } from '../seed'
import * as db from './db'
import {
  enqueue,
  flushQueue,
  migrateLegacyQueue,
  pendingCount,
  type PendingOp,
} from './syncQueue'

/** op 하나를 실제로 서버에 보낸다 */
async function sendOp(op: PendingOp, hid: string): Promise<void> {
  switch (op.kind) {
    case 'ledger':
      return db.pushLedger(hid, op.payload)
    case 'snapshot':
      return db.pushSnapshot(hid, op.payload)
    case 'occasion':
      return db.pushOccasion(hid, op.payload)
    case 'occasionDelete':
      return db.deleteOccasion(op.payload.id)
    case 'profile':
      return db.pushProfile(hid, op.payload)
    case 'categories':
      return db.pushCategories(hid, op.payload)
    case 'aliases':
      return db.pushAliases(hid, op.payload)
    case 'confession':
      return db.insertConfession(hid, op.payload)
    case 'confessionDelete':
      return db.deleteConfession(op.payload.id)
  }
}

/**
 * 저장 실패 처리 — 콘솔에만 남기지 않고 큐에 넣어 나중에 재전송한다.
 * 화면은 이미 낙관적으로 바뀐 상태라, 큐가 없으면 사용자는 저장된 줄 알고 앱을 닫는다.
 */
function onSaveFailed(op: PendingOp) {
  return (err: unknown) => {
    console.error('[sync] 저장 실패, 재시도 큐에 넣음:', op.kind, err)
    enqueue(op)
    useLedgerStore.setState({ pendingSync: pendingCount() })
  }
}

/**
 * 전체 초기화·가져오기 실패용. 이 둘은 큐에 넣지 않는다 —
 * 나중에 replay 하면 그사이 쌓인 최신 데이터를 지워버릴 수 있기 때문.
 * 대신 사용자에게 바로 알린다.
 */
function reportSyncError(err: unknown) {
  console.error('[sync] Supabase 저장 실패:', err)
  useLedgerStore.setState({ syncFailed: true })
}

/** 큐를 비우고 남은 건수를 스토어에 반영 */
export async function flushPendingSync(): Promise<void> {
  const hid = useLedgerStore.getState().householdId
  if (!hid) return
  const left = await flushQueue(hid, sendOp)
  useLedgerStore.setState({ pendingSync: left })
}

const EMPTY: AppData = {
  profile: {
    member1Name: '남편',
    member2Name: '아내',
    childNames: [],
    targetNetWorth: 1_000_000_000,
    startYear: new Date().getFullYear(),
  },
  ledgers: [],
  snapshots: [],
  occasions: [],
  categories: {
    income: [...DEFAULT_CATEGORIES.income],
    saving: [...DEFAULT_CATEGORIES.saving],
    investment: [...DEFAULT_CATEGORIES.investment],
    fixed: [...DEFAULT_CATEGORIES.fixed],
    variable: [...DEFAULT_CATEGORIES.variable],
  },
}

interface LedgerState extends AppData {
  // 온라인 상태
  status: 'idle' | 'loading' | 'ready' | 'error'
  householdId: string | null
  memberNo: 1 | 2 | null // 로그인한 사용자가 구성원 1(남편)인지 2(아내)인지
  inviteCode: string | null
  sample: boolean // 샘플 둘러보기 모드 (householdId가 없어 DB 저장은 자동으로 건너뜀)
  confessions: Confession[] // 일일 고백 로그 (최근 62일, 정산과 독립)
  pendingSync: number // 아직 서버에 못 보낸 저장 건수 (연결되면 자동 재전송)
  syncFailed: boolean // 재시도할 수 없는 저장 실패 (전체 초기화·가져오기)
  init: (membership: db.Membership) => Promise<void>
  loadSample: () => void
  clear: () => void
  // 일일 고백: 로컬 즉시 반영 → 백그라운드 전송(실패 시 큐)
  addConfession: (c: Omit<Confession, 'id' | 'createdAt' | 'memberNo'>) => Confession
  removeConfession: (id: string) => void
  // 줄글 고백 학습 별칭 (단어 → 카테고리)
  aliases: Record<string, string>
  learnAliases: (patch: Record<string, string>) => void
  // 프로필
  updateProfile: (patch: Partial<Profile>) => void
  // 월간 가계부
  saveLedger: (ledger: MonthlyLedger) => void
  // 자산 스냅샷
  saveSnapshot: (snapshot: AssetSnapshot) => void
  // 경조사/연간비
  addOccasion: (entry: Omit<OccasionEntry, 'id'>) => void
  removeOccasion: (id: string) => void
  // 카테고리 관리
  addCategory: (group: CategoryGroup, name: string) => void
  removeCategory: (group: CategoryGroup, name: string) => void
  // 데이터 관리
  resetData: () => void
  importData: (data: AppData) => void
  exportData: () => AppData
}

export const useLedgerStore = create<LedgerState>()((set, get) => ({
  ...EMPTY,
  status: 'idle',
  householdId: null,
  memberNo: null,
  inviteCode: null,
  sample: false,
  confessions: [],
  aliases: {},
  pendingSync: 0,
  syncFailed: false,

  init: async ({ householdId, memberNo }) => {
    set({ status: 'loading', householdId, memberNo, sample: false })
    try {
      const { inviteCode, ...data } = await db.fetchHouseholdData(householdId)
      set({ ...data, inviteCode, status: 'ready' })
    } catch (err) {
      console.error('[sync] 데이터 로드 실패:', err)
      set({ status: 'error' })
      return
    }
    // 못 보낸 저장분 재전송 → 최근 고백 로그 로드 (실패해도 앱 사용엔 지장 없음)
    migrateLegacyQueue()
    await flushPendingSync()
    try {
      set({ confessions: await db.fetchConfessions(householdId) })
    } catch (err) {
      console.error('[sync] 고백 로그 동기화 실패:', err)
    }
  },

  // 샘플 둘러보기: 시드(예시) 데이터를 로컬에서만 보여줌.
  // householdId가 null이므로 아래 액션들의 DB 저장은 모두 건너뛰어짐.
  loadSample: () =>
    set({
      ...buildSeed(),
      status: 'ready',
      householdId: null,
      memberNo: 1,
      inviteCode: null,
      sample: true,
      confessions: [],
      aliases: {},
    }),

  clear: () =>
    set({
      ...EMPTY,
      status: 'idle',
      householdId: null,
      memberNo: null,
      inviteCode: null,
      sample: false,
      confessions: [],
      aliases: {},
      pendingSync: 0,
      syncFailed: false,
    }),

  learnAliases: (patch) => {
    const merged = { ...get().aliases, ...patch }
    set({ aliases: merged })
    const hid = get().householdId
    if (hid) {
      const op: PendingOp = { kind: 'aliases', key: 'aliases', payload: merged }
      db.pushAliases(hid, merged).catch(onSaveFailed(op))
    }
  },

  addConfession: (c) => {
    const s = get()
    const full: Confession = {
      ...c,
      id: genId(),
      memberNo: s.memberNo ?? 1,
      createdAt: new Date().toISOString(),
    }
    // 1) 로컬 즉시 반영 (반응 0.3초 규칙 — 네트워크를 기다리지 않는다)
    set({ confessions: [full, ...s.confessions] })
    // 2) 백그라운드 전송, 실패 시 오프라인 큐
    //    내 구성원 번호를 모르면 서버가 거부하므로(작성자 위조 방지 정책) 보내지 않는다
    if (s.householdId && s.memberNo) {
      const op: PendingOp = { kind: 'confession', key: `confession:${full.id}`, payload: full }
      db.insertConfession(s.householdId, full).catch(onSaveFailed(op))
    }
    return full
  },

  removeConfession: (id) => {
    const s = get()
    const target = s.confessions.find((c) => c.id === id)
    // 내가 쓴 것만 지운다 — 서버 정책도 배우자 것은 거부하므로 로컬만 지워지는 사고 방지
    if (!target || (s.memberNo && target.memberNo !== s.memberNo)) return
    set({ confessions: s.confessions.filter((c) => c.id !== id) })
    if (s.householdId) {
      const op: PendingOp = { kind: 'confessionDelete', key: `confessionDelete:${id}`, payload: { id } }
      db.deleteConfession(id).catch(onSaveFailed(op))
    }
  },

  updateProfile: (patch) => {
    const profile = { ...get().profile, ...patch }
    set({ profile })
    const hid = get().householdId
    if (hid) {
      const op: PendingOp = { kind: 'profile', key: 'profile', payload: profile }
      db.pushProfile(hid, profile).catch(onSaveFailed(op))
    }
  },

  saveLedger: (ledger) => {
    set((s) => {
      const rest = s.ledgers.filter((l) => l.ym !== ledger.ym)
      return { ledgers: [...rest, ledger].sort((a, b) => (a.ym < b.ym ? -1 : 1)) }
    })
    const hid = get().householdId
    if (hid) {
      const op: PendingOp = { kind: 'ledger', key: `ledger:${ledger.ym}`, payload: ledger }
      db.pushLedger(hid, ledger).catch(onSaveFailed(op))
    }
  },

  saveSnapshot: (snapshot) => {
    set((s) => {
      const rest = s.snapshots.filter((sn) => sn.ym !== snapshot.ym)
      return { snapshots: [...rest, snapshot].sort((a, b) => (a.ym < b.ym ? -1 : 1)) }
    })
    const hid = get().householdId
    if (hid) {
      const op: PendingOp = { kind: 'snapshot', key: `snapshot:${snapshot.ym}`, payload: snapshot }
      db.pushSnapshot(hid, snapshot).catch(onSaveFailed(op))
    }
  },

  addOccasion: (entry) => {
    const full: OccasionEntry = { ...entry, id: genId() }
    set((s) => ({
      occasions: [...s.occasions, full].sort((a, b) => (a.date < b.date ? 1 : -1)),
    }))
    const hid = get().householdId
    if (hid) {
      const op: PendingOp = { kind: 'occasion', key: `occasion:${full.id}`, payload: full }
      db.pushOccasion(hid, full).catch(onSaveFailed(op))
    }
  },

  removeOccasion: (id) => {
    set((s) => ({ occasions: s.occasions.filter((o) => o.id !== id) }))
    if (get().householdId) {
      const op: PendingOp = { kind: 'occasionDelete', key: `occasionDelete:${id}`, payload: { id } }
      db.deleteOccasion(id).catch(onSaveFailed(op))
    }
  },

  addCategory: (group, name) => {
    const trimmed = name.trim()
    const s = get()
    if (!trimmed || s.categories[group].includes(trimmed)) return
    // 같은 이름이 다른 그룹에 있으면 거부 — 스텝마다 항목이 갈라져 "안 지워진다"가 된다
    if (findCategoryGroup(s.categories, trimmed, group)) return
    const categories = { ...s.categories, [group]: [...s.categories[group], trimmed] }
    set({ categories })
    if (s.householdId) {
      const op: PendingOp = { kind: 'categories', key: 'categories', payload: categories }
      db.pushCategories(s.householdId, categories).catch(onSaveFailed(op))
    }
  },

  removeCategory: (group, name) => {
    const s = get()
    const categories = {
      ...s.categories,
      [group]: s.categories[group].filter((c) => c !== name),
    }
    set({ categories })
    if (s.householdId) {
      const op: PendingOp = { kind: 'categories', key: 'categories', payload: categories }
      db.pushCategories(s.householdId, categories).catch(onSaveFailed(op))
    }
  },

  resetData: () => {
    const hid = get().householdId
    // 고백과 연말정산 입력도 함께 — "초기화해도 남아있어요" 신고의 원인
    set({ ledgers: [], snapshots: [], occasions: [], confessions: [] })
    localStorage.removeItem(YEAREND_SAVE_KEY)
    if (hid) db.clearHouseholdRecords(hid).catch(reportSyncError)
  },

  importData: (data) => {
    set({
      profile: data.profile,
      ledgers: data.ledgers,
      snapshots: data.snapshots,
      occasions: data.occasions,
      categories: data.categories,
    })
    const hid = get().householdId
    if (hid) db.replaceAllData(hid, data).catch(reportSyncError)
  },

  exportData: () => {
    const s = get()
    return {
      profile: s.profile,
      ledgers: s.ledgers,
      snapshots: s.snapshots,
      occasions: s.occasions,
      categories: s.categories,
    }
  },
}))
