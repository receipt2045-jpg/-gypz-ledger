import { describe, expect, it } from 'vitest'
import {
  buildReportDraft,
  computeReportStats,
  percentileOf,
  pickIssues,
  type HouseholdData,
} from './reportDraft'
import type { AssetItem, BudgetItem, MonthlyLedger, Profile } from '../types'

const profile: Profile = {
  member1Name: '남편',
  member2Name: '아내',
  childNames: [],
  targetNetWorth: 1_000_000_000,
  startYear: 2026,
}

const it_ = (
  group: BudgetItem['group'],
  category: string,
  amount: number,
  member: 1 | 2 = 1,
): BudgetItem => ({
  id: `${group}-${category}-${member}`,
  group,
  category,
  member,
  planned: amount,
  actual: amount,
})

const ledger = (ym: string, items: BudgetItem[]): MonthlyLedger => ({
  ym,
  items,
  closed: true,
  settledMembers: [1, 2],
})

const asset = (name: string, amount: number, group: AssetItem['group'] = 'cash'): AssetItem => ({
  id: name,
  kind: 'asset',
  group,
  name,
  amount,
})

const debt = (name: string, amount: number): AssetItem => ({
  id: name,
  kind: 'debt',
  group: 'cash',
  name,
  amount,
})

/** 건강한 가구: 수입 700, 저축 250, 지출 350, 비상금 넉넉 */
function healthy(): HouseholdData {
  const items = [
    it_('income', '주수입', 7_000_000),
    it_('saving', '적금', 1_500_000),
    it_('saving', '주택청약', 200_000),
    it_('investment', '주식', 800_000),
    it_('fixed', '주거', 1_500_000),
    it_('variable', '식비', 1_200_000),
    it_('variable', '카페', 300_000),
  ]
  return {
    profile,
    ledgers: [ledger('2026-06', items), ledger('2026-07', items), ledger('2026-08', items)],
    snapshots: [{ ym: '2026-08', items: [asset('비상금', 20_000_000), asset('주식계좌', 30_000_000, 'stock')] }],
    occasions: [],
  }
}

describe('percentileOf — 우리집 위치', () => {
  it('표본이 5개 미만이면 말하지 않는다', () => {
    expect(percentileOf(0.4, [0.1, 0.2, 0.3])).toBeNull()
  })

  it('저축률이 높을수록 상위 퍼센트가 낮다', () => {
    const rates = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
    const high = percentileOf(0.6, rates)!
    const low = percentileOf(0.1, rates)!
    expect(high).toBeLessThan(low)
  })
})

describe('computeReportStats — 숫자 뽑기', () => {
  it('결산 안 끝난 달은 평균에서 뺀다', () => {
    const d = healthy()
    d.ledgers.push({ ...ledger('2026-09', [it_('income', '주수입', 99_000_000)]), closed: false })
    expect(computeReportStats(d).avgIncome).toBe(7_000_000)
  })

  it('저축률·비상금·고정비 비중을 계산한다', () => {
    const s = computeReportStats(healthy())
    expect(Math.round(s.savingRate * 100)).toBe(36) // (150+20+80)/700
    expect(s.emergencyMonths).toBeCloseTo(20_000_000 / 3_000_000, 1) // 현금 2천만 / 월지출 300만
    expect(Math.round(s.fixedRatio * 100)).toBe(21)
  })

  it('변동지출을 큰 순서로 뽑는다', () => {
    const s = computeReportStats(healthy())
    expect(s.topVariable[0].category).toBe('식비')
    expect(s.topVariable[0].amount).toBe(1_200_000)
  })

  it('청약이 있으면 알아본다', () => {
    expect(computeReportStats(healthy()).hasHousingSubscription).toBe(true)
  })

  it('목표까지 남은 햇수를 계산한다', () => {
    const s = computeReportStats(healthy())
    // 순자산 5천만, 목표 10억 → 9.5억 / (월 250만 × 12)
    expect(s.yearsToTarget).toBeCloseTo(950_000_000 / 30_000_000, 1)
  })

  it('결산한 달이 없으면 0개월', () => {
    const s = computeReportStats({ profile, ledgers: [], snapshots: [], occasions: [] })
    expect(s.months).toBe(0)
    expect(s.avgIncome).toBe(0)
  })
})

describe('pickIssues — 급한 순서', () => {
  it('건강한 가구는 잡히는 문제가 없다', () => {
    expect(pickIssues(computeReportStats(healthy()))).toHaveLength(0)
  })

  it('적자면 그게 1순위', () => {
    const d = healthy()
    d.ledgers = d.ledgers.map((l) => ledger(l.ym, [...l.items, it_('variable', '배달', 4_000_000)]))
    expect(pickIssues(computeReportStats(d))[0].key).toBe('deficit')
  })

  it('비상금이 얇으면 잡아낸다', () => {
    const d = healthy()
    d.snapshots = [{ ym: '2026-08', items: [asset('비상금', 1_000_000)] }]
    const keys = pickIssues(computeReportStats(d)).map((i) => i.key)
    expect(keys).toContain('emergency')
  })

  it('부채가 자산의 절반을 넘으면 잡아낸다', () => {
    const d = healthy()
    d.snapshots = [
      { ym: '2026-08', items: [asset('비상금', 20_000_000), debt('신용대출', 15_000_000)] },
    ]
    expect(pickIssues(computeReportStats(d)).map((i) => i.key)).toContain('debt')
  })

  it('청약이 없으면 잡아낸다', () => {
    const d = healthy()
    d.ledgers = d.ledgers.map((l) =>
      ledger(l.ym, l.items.filter((x) => !x.category.includes('청약'))),
    )
    expect(pickIssues(computeReportStats(d)).map((i) => i.key)).toContain('subscription')
  })
})

describe('buildReportDraft — 초안 원고', () => {
  it('정산한 달이 없으면 안내만 보낸다', () => {
    const text = buildReportDraft({ profile, ledgers: [], snapshots: [], occasions: [] })
    expect(text).toContain('정산을 마친 달이 없어서')
    expect(text).not.toContain('## 우리집 숫자')
  })

  it('구성원 이름으로 인사한다', () => {
    expect(buildReportDraft(healthy())).toContain('남편·아내 님')
  })

  it('모든 섹션이 들어간다', () => {
    const text = buildReportDraft(healthy())
    for (const h of ['## 우리집 숫자', '## 10년 목표까지', '## 지금 제일 급한 것', '## 다음 3개월에 할 일', '## 점검표']) {
      expect(text).toContain(h)
    }
  })

  it('문제가 있으면 급한 것부터 본문에 올린다', () => {
    const d = healthy()
    d.snapshots = [{ ym: '2026-08', items: [asset('비상금', 500_000)] }]
    const text = buildReportDraft(d)
    expect(text).toContain('비상금이 얇습니다')
  })

  it('표본이 충분하면 우리집 위치를 넣는다', () => {
    const bench = { rates: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3] }
    expect(buildReportDraft(healthy(), bench)).toContain('상위')
  })
})
