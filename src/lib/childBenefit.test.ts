import { describe, expect, it } from 'vitest'
import { allowanceAge, computeBenefit, type BenefitInput } from './childBenefit'

const base: BenefitInput = {
  birth: '2026-03-10',
  order: 1,
  region: 'metro',
  voucher: false,
  daycare: false,
}
const now = new Date('2026-10-27T12:00:00') // 25일이 지났다 → 11월분부터

describe('아이 지원금 계산 (2026-10-27)', () => {
  it('아동수당 나이: 2026년 9세 미만에서 해마다 1세씩, 2030년부터 13세 미만', () => {
    expect([2025, 2026, 2027, 2028, 2029, 2030, 2035].map(allowanceAge)).toEqual([
      8, 9, 10, 11, 12, 13, 13,
    ])
  })

  it('2026년 3월생 — 부모급여는 0세 남은 달 100만, 1세 12달 50만, 아동수당은 13세 생일 전달까지', () => {
    const r = computeBenefit(base, now)
    expect(r.startYm).toBe('2026-11')
    // 11월~내년 2월(0~11개월) 4달 × 100만 + 1세 12달 × 50만
    expect(r.parentPay).toEqual({ months: 16, total: 4_000_000 + 6_000_000, lastYm: '2028-02' })
    // 2039년 3월에 13세 → 2039년 2월까지
    expect(r.allowance.lastYm).toBe('2039-02')
    expect(r.allowance.months).toBe(148)
    expect(r.allowance.total).toBe(148 * 100_000)
    // 집에서 보면 24~85개월 가정양육수당
    expect(r.homeCare).toEqual({ months: 62, total: 6_200_000, lastYm: '2033-04' })
    expect(r.firstMeetAhead).toBe(false)
    expect(r.phases[0]).toMatchObject({ from: '2026-11', to: '2027-02', monthly: 1_100_000 })
  })

  it('어린이집에 다니면 0세는 보육료 빼고 남는 돈, 1세는 현금이 없고 양육수당도 없다', () => {
    const r = computeBenefit({ ...base, daycare: true }, now)
    expect(r.parentPay).toMatchObject({ months: 4, total: 4 * 416_000 })
    expect(r.homeCare.months).toBe(0)
  })

  it('아직 안 태어났으면 예정일 달부터 세고 첫만남이용권(둘째 300만)도 더한다', () => {
    const r = computeBenefit(
      { ...base, birth: '2027-02-01', order: 2, region: 'declineSpecial', voucher: true },
      now,
    )
    expect(r.startYm).toBe('2027-02')
    expect(r.parentPay.months).toBe(24)
    expect(r.allowance.total).toBe(r.allowance.months * 130_000)
    expect(r.firstMeetAhead).toBe(true)
    expect(r.total).toBe(r.parentPay.total + r.allowance.total + r.homeCare.total + 3_000_000)
  })

  it('2017년생은 2026년에도 받는다(법 바뀌기 전 끊겼던 아이), 2016년생은 끝났다', () => {
    const y17 = computeBenefit({ ...base, birth: '2017-01-05' }, now)
    expect(y17.allowance.months).toBeGreaterThan(0)
    expect(y17.parentPay.months).toBe(0)
    const y16 = computeBenefit({ ...base, birth: '2016-12-05' }, now)
    expect(y16.allowance.months).toBe(0)
    expect(y16.total).toBe(0)
  })
})
