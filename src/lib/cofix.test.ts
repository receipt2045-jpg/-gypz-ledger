import { describe, expect, it } from 'vitest'
import { computeCofix, monthlyPay } from './cofix'

describe('cofix', () => {
  it('카드 숫자와 같다: 6억 × 0.19% = 1년 114만, 한 달 9.5만', () => {
    const r = computeCofix({ balance: 600_000_000, rate: 4, rise: 0.19, years: 30, repay: 'interestOnly' })
    expect(Math.round(r.diffYear)).toBe(1_140_000)
    expect(Math.round(r.diff)).toBe(95_000)
    expect(Math.round(r.simple)).toBe(95_000)
  })

  it('원리금균등: 3억 30년 4% → 한 달 약 143만', () => {
    expect(Math.round(monthlyPay(300_000_000, 4, 30, 'amortized'))).toBe(1_432_246)
  })

  it('원리금균등은 원금도 같이 갚아서 이자만 단순 계산보다 덜 는다 (3억 30년 4% +0.19%p → 약 3.3만)', () => {
    const r = computeCofix({ balance: 300_000_000, rate: 4, rise: 0.19, years: 30, repay: 'amortized' })
    expect(Math.round(r.diff)).toBe(33_055)
    expect(r.diff).toBeLessThan(r.simple)
  })

  it('잔액 0이면 0', () => {
    expect(computeCofix({ balance: 0, rate: 4, rise: 1, years: 30, repay: 'amortized' }).diff).toBe(0)
  })
})
