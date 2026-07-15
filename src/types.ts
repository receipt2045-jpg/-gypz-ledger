export type CategoryGroup = 'income' | 'saving' | 'investment' | 'fixed' | 'variable'
// 그룹 라벨: 수입, 저축, 투자, 고정지출, 변동지출

export interface Profile {
  member1Name: string // 기본 "남편"
  member2Name: string // 기본 "아내"
  targetNetWorth: number // 10년 목표 순자산(원)
  startYear: number
}

export interface BudgetItem {
  id: string
  group: CategoryGroup
  category: string // 예: 주수입, 식비, 예금...
  member: 1 | 2 // 구성원
  planned: number // 예산
  actual: number // 결산(실제)
  note?: string
}

export interface MonthlyLedger {
  ym: string // "2026-07"
  items: BudgetItem[]
  closed: boolean // 결산 완료 여부
}

export type AssetGroup = 'cash' | 'stock' | 'realestate' | 'pension' | 'consumable'
// 라벨: 현금성, 주식/코인, 부동산, 연금/보험, 소비재(자동차 등)

export interface AssetItem {
  id: string
  kind: 'asset' | 'debt'
  group: AssetGroup
  name: string // 예: 토스 비상금, 신한 청약
  amount: number // 원
  owner?: string // 남편/아내/공동
  note?: string
}

export interface AssetSnapshot {
  ym: string // 월 단위 스냅샷
  items: AssetItem[]
}

export interface OccasionEntry {
  // 경조사/연간비 기록
  id: string
  date: string // "2026-05-18"
  category: string // 가족경조사/지인경조사/기타
  title: string
  amount: number
}

export type Categories = Record<CategoryGroup, string[]>

export interface AppData {
  profile: Profile
  ledgers: MonthlyLedger[]
  snapshots: AssetSnapshot[]
  occasions: OccasionEntry[]
  categories: Categories
}
