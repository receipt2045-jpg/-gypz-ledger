import { create } from 'zustand'
import type {
  AppData,
  AssetSnapshot,
  CategoryGroup,
  MonthlyLedger,
  OccasionEntry,
  Profile,
} from '../types'
import { DEFAULT_CATEGORIES } from './constants'
import { genId } from './carryover'
import * as db from './db'

// 저장 실패를 사용자에게 조용히 알리기 위한 핸들러 (App에서 토스트 등으로 교체 가능)
function reportSyncError(err: unknown) {
  console.error('[sync] Supabase 저장 실패:', err)
}

const EMPTY: AppData = {
  profile: {
    member1Name: '남편',
    member2Name: '아내',
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
  init: (membership: db.Membership) => Promise<void>
  clear: () => void
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

  init: async ({ householdId, memberNo }) => {
    set({ status: 'loading', householdId, memberNo })
    try {
      const { inviteCode, ...data } = await db.fetchHouseholdData(householdId)
      set({ ...data, inviteCode, status: 'ready' })
    } catch (err) {
      console.error('[sync] 데이터 로드 실패:', err)
      set({ status: 'error' })
    }
  },

  clear: () =>
    set({ ...EMPTY, status: 'idle', householdId: null, memberNo: null, inviteCode: null }),

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
