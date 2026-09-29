import { describe, expect, it } from 'vitest'
import { DEFAULT_INPUT, govAt, leavePayAt, simulate, type LeaveInput } from './parentalLeave'

const base: LeaveInput = {
  ...DEFAULT_INPUT,
  payWife: 2_500_000,
  payHusband: 2_700_000,
  fixed: 1_800_000,
  variable: 1_800_000,
  childCost: 1_500_000,
  daycareFrom: 0,
}

describe('육아휴직급여', () => {
  it('한 명만 쉬면 250 → 200 → 80%·160 상한', () => {
    expect(leavePayAt(1, 3_000_000, false)).toBe(2_500_000)
    expect(leavePayAt(4, 3_000_000, false)).toBe(2_000_000)
    expect(leavePayAt(7, 3_000_000, false)).toBe(1_600_000)
    expect(leavePayAt(7, 1_800_000, false)).toBe(1_440_000) // 80%가 상한보다 작다
  })

  it('월 최소 70만원', () => {
    expect(leavePayAt(1, 500_000, false)).toBe(700_000)
  })

  it('둘 다 쉬면 첫 6개월 상한이 달마다 오른다 (6+6)', () => {
    const pays = [1, 2, 3, 4, 5, 6].map((k) => leavePayAt(k, 5_000_000, true))
    expect(pays).toEqual([2_500_000, 2_500_000, 3_000_000, 3_500_000, 4_000_000, 4_500_000])
    expect(leavePayAt(7, 5_000_000, true)).toBe(1_600_000)
  })
})

describe('부모급여 + 아동수당', () => {
  it('0세 110만, 돌 지나면 60만', () => {
    expect(govAt(1, 0)).toBe(1_100_000)
    expect(govAt(13, 0)).toBe(600_000)
  })
  it('어린이집에 다니면 0세 41.6만 + 10만, 1세 10만', () => {
    expect(govAt(6, 7)).toBe(1_100_000)
    expect(govAt(7, 7)).toBe(516_000)
    expect(govAt(13, 13)).toBe(100_000)
  })
})

describe('simulate — 평균 없이 달마다', () => {
  it('아내 12개월: 3칸 120만 · 70만 · 30만', () => {
    const r = simulate({ ...base, who: 'wife', monthsWife: 12 })
    expect(r.monthlyNow).toBe(1_600_000)
    expect(r.months).toHaveLength(12)
    expect(r.runs.map((x) => [x.from, x.to, x.month.saved])).toEqual([
      [1, 3, 1_200_000],
      [4, 6, 700_000],
      [7, 12, 300_000],
    ])
  })

  it('남편만 쉬면 남편 몫이 휴직급여로 바뀐다', () => {
    const r = simulate({ ...base, who: 'husband', monthsHusband: 6 })
    expect(r.months[0].husbandOnLeave).toBe(true)
    expect(r.months[0].wifeOnLeave).toBe(false)
    expect(r.months[0].husband).toBe(2_500_000)
    expect(r.months[0].wife).toBe(2_500_000)
  })

  it('둘 다 번갈아: 아내 먼저 쉬고 남편이 이어서, 6+6 상한을 쓴다', () => {
    const r = simulate({ ...base, who: 'both', order: 'seq', monthsWife: 6, monthsHusband: 6 })
    expect(r.months).toHaveLength(12)
    expect(r.months[5].wifeOnLeave && !r.months[5].husbandOnLeave).toBe(true)
    expect(r.months[6].husbandOnLeave && !r.months[6].wifeOnLeave).toBe(true)
    // 남편 3번째 휴직 달(9개월째): 상한 300 → 실수령 270 그대로
    expect(r.months[8].husband).toBe(2_700_000)
    expect(r.runs.map((x) => [x.from, x.to])).toEqual([
      [1, 6],
      [7, 8],
      [9, 12],
    ])
  })

  it('둘 다 같이 쉬면 두 사람 모두 휴직급여라 적자가 난다', () => {
    const r = simulate({ ...base, who: 'both', order: 'sim', monthsWife: 6, monthsHusband: 6 })
    expect(r.months).toHaveLength(6)
    expect(r.months[0].wifeOnLeave && r.months[0].husbandOnLeave).toBe(true)
    expect(r.months[0].saved).toBe(2_500_000 + 2_500_000 + 1_100_000 - 3_600_000 - 1_500_000)
  })

  it('12개월씩 번갈아 쉬면 돌 지난 13개월째부터 부모급여가 줄어든다', () => {
    const r = simulate({ ...base, who: 'both', order: 'seq', monthsWife: 12, monthsHusband: 12 })
    expect(r.months).toHaveLength(24)
    expect(r.months[12].gov).toBe(600_000)
  })

  it('한 명만 쉬면 18개월을 골라 뒀어도 12개월까지만', () => {
    const r = simulate({ ...base, who: 'wife', monthsWife: 18 })
    expect(r.months).toHaveLength(12)
  })

  it('둘 다 쉬면 한 사람당 18개월 — 13개월째부터도 80%·160 상한', () => {
    const r = simulate({ ...base, who: 'both', order: 'sim', monthsWife: 18, monthsHusband: 3 })
    expect(r.months).toHaveLength(18)
    expect(r.months[17].wifeOnLeave).toBe(true)
    expect(r.months[17].wife).toBe(1_600_000) // 250만의 80% = 200만 → 상한 160만
  })

  it('아내 18개월 뒤 남편이 이어 쉬면 19개월째 시작이라 6+6이 안 된다', () => {
    const payHusband = 5_000_000
    const late = simulate({ ...base, payHusband, who: 'both', order: 'seq', monthsWife: 18, monthsHusband: 6 })
    expect(late.months[18].husbandOnLeave).toBe(true)
    expect(late.months[18 + 5].husband).toBe(2_000_000) // 6번째 달: 일반 상한 200만
    const early = simulate({ ...base, payHusband, who: 'both', order: 'seq', monthsWife: 12, monthsHusband: 6 })
    expect(early.months[12 + 5].husband).toBe(4_500_000) // 6+6 상한 450만
  })

  it('두 돌 뒤엔 부모급여가 끝나고 집에서 보면 양육수당 10만 + 아동수당 10만', () => {
    expect(govAt(25, 0)).toBe(200_000)
    expect(govAt(25, 13)).toBe(100_000)
  })

  it('고정비·변동비는 그대로 쓴다고 본다', () => {
    const r = simulate({ ...base, who: 'wife', monthsWife: 3 })
    expect(r.months.every((m) => m.spend === 3_600_000)).toBe(true)
  })
})
