import { describe, expect, it } from 'vitest'
import { buildFixedCostReport, headlineOf } from './fixedCostBenchmark'
import type { BudgetItem } from '../types'

const item = (
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

/** 월 500만 버는 집 */
const income500 = [item('income', '주수입', 3_000_000, 1), item('income', '주수입', 2_000_000, 2)]

describe('buildFixedCostReport — 수입 대비로 본다', () => {
  it('같은 20만원도 수입에 따라 다르게 판단한다', () => {
    const rich = buildFixedCostReport(
      [item('income', '주수입', 7_000_000), item('fixed', '보험', 200_000)],
      true,
    )
    const tight = buildFixedCostReport(
      [item('income', '주수입', 1_500_000), item('fixed', '보험', 200_000)],
      true,
    )
    expect(rich.categories[0].status).toBe('ok') // 2.9%
    expect(tight.categories[0].status).toBe('over') // 13.3%
  })

  it('부부가 각자 낸 같은 항목은 합쳐서 본다', () => {
    const r = buildFixedCostReport(
      [...income500, item('fixed', '보험', 300_000, 1), item('fixed', '보험', 300_000, 2)],
      true,
    )
    expect(r.categories[0].amount).toBe(600_000) // 12% > 10%
    expect(r.categories[0].status).toBe('over')
  })

  it('넘은 만큼과 10년치를 알려준다', () => {
    // 수입 500만, 보험 70만 → 상한 50만, 20만 초과
    const r = buildFixedCostReport([...income500, item('fixed', '보험', 700_000)], true)
    const 보험 = r.categories.find((c) => c.category === '보험')!
    expect(보험.overBy).toBe(200_000)
    expect(보험.tenYear).toBe(24_000_000) // 20만 × 12 × 10
  })

  it('기준이 없는 카테고리는 판단하지 않는다', () => {
    const r = buildFixedCostReport([...income500, item('fixed', '기타', 100_000)], true)
    expect(r.categories[0].status).toBe('unknown')
    expect(r.categories[0].overBy).toBe(0)
  })

  it('수입이 없으면 비교하지 않는다', () => {
    const r = buildFixedCostReport([item('fixed', '보험', 500_000)], true)
    expect(r.totalStatus).toBe('unknown')
    expect(r.categories[0].status).toBe('unknown')
    expect(headlineOf(r)).toContain('수입을 넣으면')
  })

  it('줄일 여지가 큰 항목부터 보여준다', () => {
    const r = buildFixedCostReport(
      [
        ...income500,
        item('fixed', '통신', 400_000), // 8% (상한 5%) → 15만 초과
        item('fixed', '보험', 700_000), // 14% (상한 10%) → 20만 초과
        item('fixed', '구독', 20_000), // 0.4% → ok
      ],
      true,
    )
    expect(r.categories.map((c) => c.category)).toEqual(['보험', '통신', '구독'])
    expect(r.totalOverBy).toBe(350_000)
    expect(r.tenYearTotal).toBe(42_000_000)
  })

  it('결산 전이면 계획값, 결산 후면 실제값을 본다', () => {
    const items: BudgetItem[] = [
      { ...item('income', '주수입', 0), planned: 5_000_000, actual: 4_000_000 },
      { ...item('fixed', '보험', 0), planned: 400_000, actual: 600_000 },
    ]
    expect(buildFixedCostReport(items, false).categories[0].amount).toBe(400_000)
    expect(buildFixedCostReport(items, true).categories[0].amount).toBe(600_000)
  })
})

describe('headlineOf — 겁주지 않고 방향만', () => {
  it('고정비가 절반을 넘으면 총량 문제를 먼저 말한다', () => {
    const r = buildFixedCostReport([...income500, item('fixed', '주거', 3_000_000)], true)
    expect(headlineOf(r)).toContain('절반을 넘으면')
  })

  it('총량은 괜찮지만 줄일 항목이 있으면 그렇게 말한다', () => {
    const r = buildFixedCostReport([...income500, item('fixed', '통신', 400_000)], true)
    expect(headlineOf(r)).toContain('줄일 여지')
  })

  it('다 괜찮으면 칭찬한다', () => {
    const r = buildFixedCostReport([...income500, item('fixed', '통신', 150_000)], true)
    expect(headlineOf(r)).toContain('잘 잡혀 있습니다')
  })
})
