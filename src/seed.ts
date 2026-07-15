import type {
  AppData,
  AssetItem,
  AssetSnapshot,
  BudgetItem,
  CategoryGroup,
  MonthlyLedger,
  OccasionEntry,
  Profile,
} from './types'
import { DEFAULT_CATEGORIES } from './lib/constants'

const MONTHS = ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']
const LAST_INDEX = MONTHS.length - 1 // 2026-07 은 아직 정산 전(closed=false)

interface ItemTpl {
  group: CategoryGroup
  category: string
  member: 1 | 2
  planned: number
}

// 엑셀 원본 구조를 반영한 매월 공통 항목 템플릿
const ITEM_TEMPLATE: ItemTpl[] = [
  // 수입
  { group: 'income', category: '주수입', member: 1, planned: 3_200_000 },
  { group: 'income', category: '주수입', member: 2, planned: 3_000_000 },
  { group: 'income', category: '부수입', member: 1, planned: 0 },
  // 저축
  { group: 'saving', category: '예금', member: 1, planned: 1_500_000 },
  { group: 'saving', category: '주택청약', member: 1, planned: 100_000 },
  { group: 'saving', category: '주택청약', member: 2, planned: 100_000 },
  { group: 'saving', category: '연금', member: 1, planned: 300_000 },
  { group: 'saving', category: '목적저금', member: 2, planned: 300_000 },
  // 투자
  { group: 'investment', category: '주식', member: 1, planned: 700_000 },
  { group: 'investment', category: '코인', member: 2, planned: 100_000 },
  // 고정지출
  { group: 'fixed', category: '보험', member: 1, planned: 100_000 },
  { group: 'fixed', category: '보험', member: 2, planned: 100_000 },
  { group: 'fixed', category: '통신', member: 1, planned: 30_000 },
  { group: 'fixed', category: '통신', member: 2, planned: 30_000 },
  { group: 'fixed', category: '용돈', member: 1, planned: 300_000 },
  { group: 'fixed', category: '용돈', member: 2, planned: 300_000 },
  { group: 'fixed', category: '주거', member: 1, planned: 500_000 },
  { group: 'fixed', category: '구독', member: 1, planned: 29_000 },
  // 변동지출
  { group: 'variable', category: '식비', member: 1, planned: 900_000 },
  { group: 'variable', category: '생활용품', member: 1, planned: 100_000 },
  { group: 'variable', category: '건강', member: 2, planned: 50_000 },
  { group: 'variable', category: '문화생활', member: 1, planned: 120_000 },
  { group: 'variable', category: '자동차', member: 1, planned: 80_000 },
  { group: 'variable', category: '반려견', member: 2, planned: 60_000 },
  { group: 'variable', category: '경조사', member: 1, planned: 100_000 },
]

// 부수입은 달마다 들쭉날쭉
const SUB_INCOME = [0, 300_000, 0, 500_000, 0, 200_000]
// 변동지출 결산 변동폭 (actual = planned * factor), 마지막(7월)은 아직 미정산
const VAR_FACTOR = [1.04, 0.95, 1.09, 0.97, 1.03, 1]

function buildLedger(i: number): MonthlyLedger {
  const ym = MONTHS[i]
  const closed = i < LAST_INDEX

  const items: BudgetItem[] = ITEM_TEMPLATE.map((tpl) => {
    let planned = tpl.planned
    if (tpl.category === '부수입') planned = SUB_INCOME[i]

    let actual: number
    if (!closed) {
      // 7월: 고정성 항목은 이월값, 변동지출은 아직 0
      actual = tpl.group === 'variable' ? 0 : planned
    } else if (tpl.group === 'variable') {
      actual = Math.round((planned * VAR_FACTOR[i]) / 1000) * 1000
    } else {
      actual = planned
    }

    return {
      id: `${ym}-${tpl.group}-${tpl.category}-${tpl.member}`,
      group: tpl.group,
      category: tpl.category,
      member: tpl.member,
      planned,
      actual,
    }
  })

  return { ym, items, closed }
}

// ── 자산 스냅샷 ─────────────────────────────────────────────
const STOCK_DELTA = [0, 650_000, 1_300_000, 900_000, 1_900_000, 2_500_000]
const COIN_DELTA = [0, 200_000, -150_000, 400_000, 700_000, 1_100_000]

function buildSnapshot(i: number): AssetSnapshot {
  const ym = MONTHS[i]
  const raw: Omit<AssetItem, 'id'>[] = [
    { kind: 'asset', group: 'cash', name: '토스 비상금', owner: '공동', amount: 18_000_000 + i * 450_000 },
    { kind: 'asset', group: 'cash', name: '신한 주택청약', owner: '남편', amount: 6_000_000 + i * 100_000 },
    { kind: 'asset', group: 'cash', name: '우리 주택청약', owner: '아내', amount: 5_500_000 + i * 100_000 },
    { kind: 'asset', group: 'stock', name: '토스증권 주식', owner: '공동', amount: 32_000_000 + STOCK_DELTA[i] },
    { kind: 'asset', group: 'stock', name: '업비트 코인', owner: '아내', amount: 3_000_000 + COIN_DELTA[i] },
    { kind: 'asset', group: 'realestate', name: '전세보증금', owner: '공동', amount: 300_000_000 },
    { kind: 'asset', group: 'pension', name: '연금저축', owner: '공동', amount: 8_000_000 + i * 300_000 },
    { kind: 'asset', group: 'consumable', name: '자동차(그랜저)', owner: '남편', amount: 15_000_000 - i * 150_000 },
    { kind: 'debt', group: 'cash', name: '전세자금대출', owner: '공동', amount: 120_000_000 },
    { kind: 'debt', group: 'cash', name: '신용대출', owner: '남편', amount: 24_000_000 - i * 400_000 },
  ]
  return {
    ym,
    items: raw.map((it) => ({ ...it, id: `${ym}-${it.name}` })),
  }
}

const OCCASIONS: OccasionEntry[] = [
  { id: 'occ-1', date: '2026-02-14', category: '지인경조사', title: '대학동기 결혼식', amount: 100_000 },
  { id: 'occ-2', date: '2026-03-21', category: '가족경조사', title: '어머니 생신', amount: 300_000 },
  { id: 'occ-3', date: '2026-05-18', category: '지인경조사', title: '회사동료 결혼식', amount: 200_000 },
  { id: 'occ-4', date: '2026-06-10', category: '기타', title: '자동차 보험 갱신', amount: 780_000 },
  { id: 'occ-5', date: '2026-07-05', category: '가족경조사', title: '조카 돌잔치', amount: 150_000 },
]

const PROFILE: Profile = {
  member1Name: '남편',
  member2Name: '아내',
  targetNetWorth: 1_000_000_000, // 10억
  startYear: 2026,
}

export function buildSeed(): AppData {
  return {
    profile: PROFILE,
    ledgers: MONTHS.map((_, i) => buildLedger(i)),
    snapshots: MONTHS.map((_, i) => buildSnapshot(i)),
    occasions: OCCASIONS,
    categories: {
      income: [...DEFAULT_CATEGORIES.income],
      saving: [...DEFAULT_CATEGORIES.saving],
      investment: [...DEFAULT_CATEGORIES.investment],
      fixed: [...DEFAULT_CATEGORIES.fixed],
      variable: [...DEFAULT_CATEGORIES.variable],
    },
  }
}
