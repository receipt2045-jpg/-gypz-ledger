import { describe, expect, it } from 'vitest'
import {
  cardDeductionLimit,
  cardThreshold,
  estimatedTaxBase,
  laborIncomeDeduction,
  marginalRate,
  medicalThreshold,
  recommendCard,
  statusOf,
} from './yearEndTax'

describe('문턱·한도', () => {
  it('카드 공제는 총급여의 25%부터', () => {
    expect(cardThreshold(40_000_000)).toBe(10_000_000)
  })
  it('의료비 공제는 총급여의 3%부터', () => {
    expect(medicalThreshold(40_000_000)).toBe(1_200_000)
  })
  it('공제 한도는 7천만원 이하 300만, 초과 250만', () => {
    expect(cardDeductionLimit(70_000_000)).toBe(3_000_000)
    expect(cardDeductionLimit(70_000_001)).toBe(2_500_000)
  })
})

describe('근로소득공제·세율', () => {
  it('구간별 근로소득공제', () => {
    expect(laborIncomeDeduction(4_000_000)).toBe(2_800_000) // 70%
    expect(laborIncomeDeduction(40_000_000)).toBe(11_250_000) // 750만 + 25백만×15%
  })
  it('총급여가 오르면 한계세율도 오르거나 같다', () => {
    const rates = [20_000_000, 40_000_000, 60_000_000, 90_000_000, 150_000_000].map((g) =>
      marginalRate(estimatedTaxBase(g)),
    )
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1])
  })
  it('과세표준은 음수가 되지 않는다', () => {
    expect(estimatedTaxBase(1_000_000)).toBe(0)
  })
})

describe('statusOf', () => {
  it('문턱을 못 넘으면 남은 금액을 알려준다', () => {
    const s = statusOf({ gross: 40_000_000, spent: 6_000_000 })
    expect(s.cleared).toBe(false)
    expect(s.remaining).toBe(4_000_000)
    expect(s.estimatedDeduction).toBe(0)
  })
  it('문턱을 넘으면 초과분의 15%가 대략 공제액', () => {
    const s = statusOf({ gross: 40_000_000, spent: 12_000_000 })
    expect(s.cleared).toBe(true)
    expect(s.remaining).toBe(0)
    expect(s.estimatedDeduction).toBe(300_000) // 200만 × 15%
  })
  it('공제액은 한도를 넘지 않는다', () => {
    const s = statusOf({ gross: 40_000_000, spent: 40_000_000 })
    expect(s.estimatedDeduction).toBe(3_000_000)
    expect(s.limitReached).toBe(true)
  })
})

describe('recommendCard — 누구 카드를 쓸까', () => {
  it('둘 다 문턱 전이면 문턱이 가까운 쪽 (보통 소득 적은 쪽)', () => {
    const r = recommendCard(
      { gross: 60_000_000, spent: 0 }, // 문턱 1,500만
      { gross: 30_000_000, spent: 0 }, // 문턱 750만
    )
    expect(r.winner).toBe(2)
    expect(r.reason).toContain('문턱까지 남은 금액')
  })

  it('한 명만 문턱을 넘었으면 넘은 쪽', () => {
    const r = recommendCard(
      { gross: 60_000_000, spent: 20_000_000 }, // 넘음
      { gross: 30_000_000, spent: 1_000_000 }, // 못 넘음
    )
    expect(r.winner).toBe(1)
  })

  it('둘 다 넘었으면 세율이 높은 쪽', () => {
    const r = recommendCard(
      { gross: 90_000_000, spent: 30_000_000 },
      { gross: 30_000_000, spent: 10_000_000 },
    )
    expect(r.winner).toBe(1)
    expect(r.reason).toContain('세율이 높은 쪽')
  })

  it('한도를 채운 쪽은 후보에서 빠진다', () => {
    const r = recommendCard(
      { gross: 90_000_000, spent: 90_000_000 }, // 한도 소진
      { gross: 30_000_000, spent: 10_000_000 },
    )
    expect(r.winner).toBe(2)
    expect(r.reason).toContain('한도')
  })

  it('둘 다 한도를 채우면 더 쓸 이유가 없다고 알려준다', () => {
    const r = recommendCard(
      { gross: 90_000_000, spent: 90_000_000 },
      { gross: 80_000_000, spent: 80_000_000 },
    )
    expect(r.winner).toBe('none')
  })

  it('조건이 같으면 어느 쪽이든', () => {
    const r = recommendCard({ gross: 40_000_000, spent: 0 }, { gross: 40_000_000, spent: 0 })
    expect(r.winner).toBe('either')
  })

  it('소득이 같고 둘 다 넘었으면 어느 쪽이든', () => {
    const r = recommendCard(
      { gross: 40_000_000, spent: 15_000_000 },
      { gross: 40_000_000, spent: 15_000_000 },
    )
    expect(r.winner).toBe('either')
  })

  it('연봉을 아직 안 넣었으면(0) 문턱도 0이라 넘은 것으로 보지 않는다', () => {
    const s = statusOf({ gross: 0, spent: 0 })
    expect(s.cleared).toBe(false)
  })
})
