import { describe, expect, it } from 'vitest'
import {
  bondRate,
  brokerFee,
  computeHomeCost,
  generalRate,
  heavyRate,
  lawyerBase,
  type HomeCostInput,
} from './homeCost'

const base: HomeCostInput = {
  price: 800_000_000,
  bondRegion: 'metro',
  adjusted: true,
  over85: false,
  homesAfter: 1,
  firstHome: false,
  temporaryTwo: false,
  loan: 0,
  publicPrice: 0,
  bondDiscount: 15,
  brokerRate: 0,
  lawyerFee: 0,
}

describe('집 살 때 드는 돈', () => {
  it('취득세율 — 6억 1%, 7억 1.6667%, 8억 2.3333%, 9억 초과 3%', () => {
    expect(generalRate(600_000_000)).toBe(1)
    expect(generalRate(700_000_000)).toBe(1.6667)
    expect(generalRate(800_000_000)).toBe(2.3333)
    expect(generalRate(900_000_000)).toBe(3)
    expect(generalRate(950_000_000)).toBe(3)
  })

  it('중과 — 조정 2주택 8%(일시적 2주택은 일반), 비조정은 3주택부터', () => {
    expect(heavyRate({ homesAfter: 2, adjusted: true, temporaryTwo: false })).toBe(8)
    expect(heavyRate({ homesAfter: 2, adjusted: true, temporaryTwo: true })).toBeNull()
    expect(heavyRate({ homesAfter: 2, adjusted: false, temporaryTwo: false })).toBeNull()
    expect(heavyRate({ homesAfter: 3, adjusted: false, temporaryTwo: false })).toBe(8)
    expect(heavyRate({ homesAfter: 4, adjusted: false, temporaryTwo: false })).toBe(12)
  })

  it('중개보수 상한 — 8억이면 0.4% + 부가세 = 352만, 1억 5천이면 한도 80만 + 부가세', () => {
    expect(brokerFee(800_000_000, 0).amount).toBe(3_520_000)
    expect(brokerFee(150_000_000, 0).amount).toBe(825_000)
    expect(brokerFee(800_000_000, 0.3).amount).toBe(2_640_000) // 협의 요율
  })

  it('법무사 기본보수 표, 채권 매입률 표', () => {
    expect(lawyerBase(800_000_000)).toBe(534_000 + 210_000)
    expect(bondRate(560_000_000, 'metro')).toBe(0.026)
    expect(bondRate(560_000_000, 'other')).toBe(0.021)
    expect(bondRate(700_000_000, 'metro')).toBe(0.031)
  })

  it('8억 · 서울 · 1주택 · 85㎡ 이하 — 취득세 1,866만, 지방교육세 그 10%, 농특세 0', () => {
    const r = computeHomeCost(base)
    const tax = r.groups[0].items
    expect(tax[0].amount).toBe(18_666_400)
    expect(tax[1].amount).toBe(1_866_640)
    expect(tax[2].amount).toBe(0)
    expect(r.total).toBeGreaterThan(25_000_000)
  })

  it('생애최초 — 12억 이하면 취득세 최대 200만원 감면', () => {
    const r = computeHomeCost({ ...base, price: 500_000_000, firstHome: true, adjusted: false })
    expect(r.groups[0].items[0].amount).toBe(3_000_000) // 500만 − 200만
  })

  it('대출이 있으면 약정서 인지세 반, 근저당 채권 부담', () => {
    const r = computeHomeCost({ ...base, loan: 300_000_000 })
    const loan = r.groups.find((g) => g.title === '대출')!
    expect(loan.items[0].amount).toBe(75_000)
    expect(loan.items[1].amount).toBe(540_000) // 3.6억 × 1% × 15%
    expect(r.bankPays.length).toBeGreaterThan(0)
  })
})
