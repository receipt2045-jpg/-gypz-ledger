import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  AppData,
  AssetSnapshot,
  CategoryGroup,
  MonthlyLedger,
  OccasionEntry,
  Profile,
} from '../types'
import { buildSeed } from '../seed'
import { genId } from './carryover'

interface LedgerState extends AppData {
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

const seed = buildSeed()

export const useLedgerStore = create<LedgerState>()(
  persist(
    (set, get) => ({
      ...seed,

      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      saveLedger: (ledger) =>
        set((s) => {
          const rest = s.ledgers.filter((l) => l.ym !== ledger.ym)
          return { ledgers: [...rest, ledger].sort((a, b) => (a.ym < b.ym ? -1 : 1)) }
        }),

      saveSnapshot: (snapshot) =>
        set((s) => {
          const rest = s.snapshots.filter((sn) => sn.ym !== snapshot.ym)
          return { snapshots: [...rest, snapshot].sort((a, b) => (a.ym < b.ym ? -1 : 1)) }
        }),

      addOccasion: (entry) =>
        set((s) => ({
          occasions: [...s.occasions, { ...entry, id: genId() }].sort((a, b) =>
            a.date < b.date ? 1 : -1,
          ),
        })),

      removeOccasion: (id) => set((s) => ({ occasions: s.occasions.filter((o) => o.id !== id) })),

      addCategory: (group, name) =>
        set((s) => {
          const trimmed = name.trim()
          if (!trimmed || s.categories[group].includes(trimmed)) return {}
          return { categories: { ...s.categories, [group]: [...s.categories[group], trimmed] } }
        }),

      removeCategory: (group, name) =>
        set((s) => ({
          categories: {
            ...s.categories,
            [group]: s.categories[group].filter((c) => c !== name),
          },
        })),

      resetData: () => set({ ...buildSeed() }),

      importData: (data) =>
        set({
          profile: data.profile,
          ledgers: data.ledgers,
          snapshots: data.snapshots,
          occasions: data.occasions,
          categories: data.categories,
        }),

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
    }),
    {
      name: 'gypz-ledger-v1',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({
        profile: s.profile,
        ledgers: s.ledgers,
        snapshots: s.snapshots,
        occasions: s.occasions,
        categories: s.categories,
      }),
    },
  ),
)
