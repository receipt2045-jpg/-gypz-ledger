import { describe, expect, it } from 'vitest'
import {
  applyToAssets,
  applyToLedger,
  livingSplit,
  savedAmount,
  summarizeSide,
  yearSide,
  type SideAllocation,
  type SideIncome,
} from './sideIncome'
import type { AssetItem, MonthlyLedger } from '../types'

let n = 0
const e = (p: Partial<SideIncome>): SideIncome => ({
  id: `e${++n}`,
  memberNo: 1,
  kind: 'cash',
  category: '앱테크',
  amount: 10_000,
  earnedOn: '2026-11-10',
  createdAt: '2026-11-10T00:00:00Z',
  ...p,
})

describe('부수입 합계 (2026-11-19)', () => {
  const list = [
    e({ amount: 30_000 }),
    e({ memberNo: 2, category: '원고료·협찬비', amount: 150_000 }),
    e({ memberNo: 2, kind: 'saved', category: '체험단', amount: 50_000 }),
    e({ shared: true, kind: 'saved', category: '포인트 결제', amount: 20_000 }),
    e({ amount: 99_000, earnedOn: '2026-10-31' }), // 다른 달
  ]

  it('들어온 돈·아낀 돈·누가·종류별로 나눠 센다 (그 달만)', () => {
    const s = summarizeSide(list, '2026-11')
    expect(s.cash).toBe(180_000)
    expect(s.saved).toBe(70_000)
    expect(s.total).toBe(250_000)
    expect(s.byWho).toEqual({ 1: 30_000, 2: 200_000, shared: 20_000 })
    expect(s.byCategory.cash.map((c) => c.category)).toEqual(['원고료·협찬비', '앱테크'])
  })

  it('올해 합계는 그 달까지', () => {
    expect(yearSide(list, '2026-11')).toEqual({ cash: 279_000, saved: 70_000 })
    expect(yearSide(list, '2026-10')).toEqual({ cash: 99_000, saved: 0 })
  })

  it('아낀 돈 = 원래 값 − 낸 돈 (음수면 0)', () => {
    expect(savedAmount(60_000, 10_000)).toBe(50_000)
    expect(savedAmount(10_000, 20_000)).toBe(0)
  })

  it('살림에 보탤 돈은 그 달 번 비율대로 나눈다 (공동은 반반)', () => {
    const cash = [
      e({ amount: 30_000 }),
      e({ memberNo: 2, amount: 60_000 }),
      e({ shared: true, amount: 20_000 }),
    ]
    // 남편 40,000 : 아내 70,000
    expect(livingSplit(cash, '2026-11', 110_000, 1)).toEqual({ 1: 40_000, 2: 70_000 })
    // 번 돈이 없으면 정산한 사람 몫
    expect(livingSplit([], '2026-11', 5_000, 2)).toEqual({ 1: 0, 2: 5_000 })
  })
})

describe('부수입 정산 — 보낸 곳에 더하고, 마감을 풀면 뺀다', () => {
  const items: AssetItem[] = [
    { id: 'a', kind: 'asset', group: 'cash', name: '토스 비상금', amount: 1_000_000 },
    { id: 'b', kind: 'asset', group: 'stock', name: '토스증권 주식', amount: 2_000_000 },
  ]
  const allocs: SideAllocation[] = [
    { to: 'asset', assetId: 'a', assetName: '토스 비상금', amount: 100_000 },
    // 이어 온 달이라 id가 달라도 이름으로
    { to: 'asset', assetId: 'old-id', assetName: '토스증권 주식', amount: 50_000 },
    { to: 'asset', assetId: 'gone', assetName: '없는 통장', amount: 7_000 },
    { to: 'living', amount: 30_000, split: { 1: 10_000, 2: 20_000 } },
  ]

  it('자산 통장 — 더하고 다시 빼면 그대로', () => {
    const added = applyToAssets(items, allocs, 1)
    expect(added.map((i) => i.amount)).toEqual([1_100_000, 2_050_000])
    expect(applyToAssets(added, allocs, -1)).toEqual(items)
  })

  it("살림 — 그 달 가계부 '부수입'에 남편·아내 몫으로, 없으면 칸을 만든다", () => {
    const ledger: MonthlyLedger = {
      ym: '2026-11',
      closed: false,
      items: [
        { id: 'i1', group: 'income', category: '부수입', member: 1, planned: 0, actual: 5_000 },
      ],
    }
    const added = applyToLedger(ledger, allocs, 1)
    const side = (m: 1 | 2) =>
      added.items.find((it) => it.category === '부수입' && it.member === m)?.actual
    expect(side(1)).toBe(15_000)
    expect(side(2)).toBe(20_000)
    const back = applyToLedger(added, allocs, -1)
    expect(back.items.find((it) => it.id === 'i1')?.actual).toBe(5_000)
    expect(back.items.find((it) => it.member === 2)?.actual).toBe(0)
  })
})
