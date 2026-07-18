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
import { DEFAULT_CATEGORIES } from './constants'
import { genId } from './carryover'
import { buildSeed } from '../seed'
import * as db from './db'

// 저장 실패를 사용자에게 조용히 알리기 위한 핸들러 (App에서 토스트 등으로 교체 가능)
function reportSyncError(err: unknown) {
  console.error('[sync] Supabase 저장 실패:', err)
}

// 일일 고백 오프라인 큐 — 전송 실패분을 보관했다가 다음 접속 때 재전송
const CONFESS_QUEUE_KEY = 'gypz-confess-queue'

function readConfessQueue(): Confession[] {
  try {
    return JSON.parse(localStorage.getItem(CONFESS_QUEUE_KEY) ?? '[]') as Confession[]
  } catch {
    return []
  }
}

function pushConfessQueue(c: Confession) {
  localStorage.setItem(CONFESS_QUEUE_KEY, JSON.stringify([...readConfessQueue(), c]))
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
  init: (membership: db.Membership) => Promise<void>
  loadSample: () => void
  clear: () => void
  // 일일 고백: 로컬 즉시 반영 → 백그라운드 전송(실패 시 큐)
  addConfession: (c: Omit<Confession, 'id' | 'createdAt' | 'memberNo'>) => Confession
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
    // 일일 고백: 오프라인 큐 재전송 → 최근 로그 로드 (실패해도 앱 사용엔 지장 없음)
    try {
      const queued = readConfessQueue()
      for (const c of queued) {
        await db.insertConfession(householdId, c)
      }
      if (queued.length > 0) localStorage.removeItem(CONFESS_QUEUE_KEY)
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
    }),

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
    if (s.householdId) {
      db.insertConfession(s.householdId, full).catch((err) => {
        reportSyncError(err)
        pushConfessQueue(full)
      })
    }
    return full
  },

  updateProfile: (patch) => {
    const profile = { ...get().profile, ...patch }
    set({ profile })
    const hid = get().householdId
    if (hid) db.pushProfile(hid, profile).catch(reportSyncError)
  },

  saveLedger: (ledger) => {
    set((s) => {
      const rest = s.ledgers.filter((l) => l.ym !== ledger.ym)
      return { ledgers: [...rest, ledger].sort((a, b) => (a.ym < b.ym ? -1 : 1)) }
    })
    const hid = get().householdId
    if (hid) db.pushLedger(hid, ledger).catch(reportSyncError)
  },

  saveSnapshot: (snapshot) => {
    set((s) => {
      const rest = s.snapshots.filter((sn) => sn.ym !== snapshot.ym)
      return { snapshots: [...rest, snapshot].sort((a, b) => (a.ym < b.ym ? -1 : 1)) }
    })
    const hid = get().householdId
    if (hid) db.pushSnapshot(hid, snapshot).catch(reportSyncError)
  },

  addOccasion: (entry) => {
    const full: OccasionEntry = { ...entry, id: genId() }
    set((s) => ({
      occasions: [...s.occasions, full].sort((a, b) => (a.date < b.date ? 1 : -1)),
    }))
    const hid = get().householdId
    if (hid) db.pushOccasion(hid, full).catch(reportSyncError)
  },

  removeOccasion: (id) => {
    set((s) => ({ occasions: s.occasions.filter((o) => o.id !== id) }))
    if (get().householdId) db.deleteOccasion(id).catch(reportSyncError)
  },

  addCategory: (group, name) => {
    const trimmed = name.trim()
    const s = get()
    if (!trimmed || s.categories[group].includes(trimmed)) return
    const categories = { ...s.categories, [group]: [...s.categories[group], trimmed] }
    set({ categories })
    if (s.householdId) db.pushCategories(s.householdId, categories).catch(reportSyncError)
  },

  removeCategory: (group, name) => {
    const s = get()
    const categories = {
      ...s.categories,
      [group]: s.categories[group].filter((c) => c !== name),
    }
    set({ categories })
    if (s.householdId) db.pushCategories(s.householdId, categories).catch(reportSyncError)
  },

  resetData: () => {
    const hid = get().householdId
    set({ ledgers: [], snapshots: [], occasions: [] })
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
