import { describe, expect, it } from 'vitest'
import {
  LOAN_CATEGORY,
  addLoanItems,
  catchUpLoan,
  graduatedPlan,
  loanLedgerAmounts,
  loanTotalCost,
  loanTotals,
  paymentIfRateUp,
  monthlyPayment,
  payDatesSince,
  payoffYm,
  type LoanInfo,
} from './loan'
import type { AssetItem, BudgetItem } from '../types'

const loan = (p: Partial<LoanInfo> = {}): LoanInfo => ({
  rate: 4.2,
  months: 336,
  payDay: 25,
  method: 'annuity',
  asOf: '2026-10-07',
  ...p,
})
const debt = (amount: number, l: LoanInfo): AssetItem => ({
  id: 'd',
  kind: 'debt',
  group: 'realestate',
  name: '주택담보대출',
  amount,
  owner: '공동',
  loan: l,
})

describe('대출 상환 계산', () => {
  it('원리금균등 — 2억 4천, 연 4.2%, 28년이면 매달 약 122만(이자 84만)', () => {
    const p = monthlyPayment(240_000_000, loan())
    expect(p.interest).toBe(840_000)
    expect(Math.round(p.payment / 10_000)).toBe(122)
    expect(p.payment).toBe(p.interest + p.principal)
  })

  it('원금균등 — 원금은 남은 기간으로 똑같이 나눈다', () => {
    const p = monthlyPayment(120_000_000, loan({ method: 'principal', months: 120, rate: 3.6 }))
    expect(p.principal).toBe(1_000_000)
    expect(p.interest).toBe(360_000)
  })

  it('만기일시 — 이자만 내다가 마지막 달에 원금', () => {
    expect(monthlyPayment(100_000_000, loan({ method: 'bullet', months: 24, rate: 4.8 }))).toEqual({
      payment: 400_000,
      interest: 400_000,
      principal: 0,
    })
    expect(
      monthlyPayment(100_000_000, loan({ method: 'bullet', months: 1, rate: 4.8 })).principal,
    ).toBe(100_000_000)
  })

  it('갚는 날이 지난 만큼만 원금을 줄인다 (31일은 말일로)', () => {
    expect(payDatesSince('2026-10-07', new Date(2026, 9, 24), 25)).toHaveLength(0)
    expect(payDatesSince('2026-10-07', new Date(2026, 11, 26), 25)).toHaveLength(3)
    expect(payDatesSince('2027-01-31', new Date(2027, 2, 31), 31).map((d) => d.getDate())).toEqual([
      28, 31,
    ])

    const before = debt(240_000_000, loan())
    const after = catchUpLoan(before, new Date(2026, 9, 26))!
    const principal = monthlyPayment(240_000_000, loan()).principal
    expect(after.amount).toBe(240_000_000 - principal)
    expect(after.loan).toMatchObject({ months: 335, asOf: '2026-10-25' })
    expect(catchUpLoan(after, new Date(2026, 9, 30))).toBeNull()
  })

  it('다 갚는 달과 이번 달 합계', () => {
    expect(payoffYm(loan({ months: 12 }), new Date(2026, 9, 7))).toBe('2027-09')
    const t = loanTotals([
      debt(240_000_000, loan()),
      { ...debt(5_000_000, loan()), loan: undefined },
    ])
    expect(t.count).toBe(1)
    expect(t.interest).toBe(840_000)
  })
})

describe('대출 → 가계부 고정지출', () => {
  it('가계부에도 넣기를 켠 대출만, 아내 이름 대출은 아내 몫', () => {
    const wife = { ...debt(100_000_000, loan({ toLedger: true })), id: 'w', owner: '아내' }
    const joint = debt(240_000_000, loan({ toLedger: true }))
    const off = { ...debt(50_000_000, loan({ toLedger: false })), id: 'o' }
    const m = loanLedgerAmounts([wife, joint, off], '아내')
    expect(m.get(2)).toBe(monthlyPayment(100_000_000, loan()).payment)
    expect(m.get(1)).toBe(monthlyPayment(240_000_000, loan()).payment)
  })

  it('이미 있는 대출 상환 항목은 그대로 두고, 없는 사람 몫만 넣는다', () => {
    const existing: BudgetItem = {
      id: 'x',
      group: 'fixed',
      category: LOAN_CATEGORY,
      member: 1,
      planned: 1_000_000,
      actual: 1_000_000,
    }
    const out = addLoanItems(
      [existing],
      new Map([
        [1, 1_215_000],
        [2, 500_000],
      ]),
      (m, a) => ({
        id: `n${m}`,
        group: 'fixed',
        category: LOAN_CATEGORY,
        member: m,
        planned: a,
        actual: a,
      }),
    )
    expect(out.map((i) => [i.member, i.planned])).toEqual([
      [1, 1_000_000],
      [2, 500_000],
    ])
  })
})

describe('총 상환액·금리 오를 때', () => {
  it('원리금균등 총 이자 = 매달 갚는 돈 × 개월 − 원금 (반올림 오차 안)', () => {
    const l = loan({ months: 360, rate: 5 })
    const { total, interest } = loanTotalCost(350_000_000, l)
    expect(total - interest).toBeGreaterThan(349_990_000)
    expect(Math.round(interest / 1e7)).toBe(33) // 약 3.3억
  })

  it('만기일시는 이자만 내다가 끝에 원금', () => {
    const { total, interest } = loanTotalCost(
      100_000_000,
      loan({ method: 'bullet', months: 12, rate: 4.8 }),
    )
    expect(interest).toBe(4_800_000)
    expect(total).toBe(104_800_000)
  })

  it('금리가 1%p 오르면 매달 갚는 돈이 는다', () => {
    const l = loan({ months: 360, rate: 5 })
    expect(paymentIfRateUp(350_000_000, l)).toBeGreaterThan(monthlyPayment(350_000_000, l).payment)
  })
})

describe('체증식 (2026-10-07)', () => {
  const g = (p: Partial<LoanInfo> = {}) => loan({ method: 'graduated', rate: 3, months: 360, ...p })

  it('공개 예시(3억·연 3%·30년)와 비슷하게 — 1개월 약 76만, 5년 차 96만, 10년 차 116만', () => {
    const plan = graduatedPlan(300_000_000, 3, 360)
    expect(Math.round(plan.first / 10_000)).toBe(76)
    expect(Math.round((plan.first + plan.step * 59) / 10_000)).toBeGreaterThanOrEqual(94)
    expect(Math.round((plan.first + plan.step * 59) / 10_000)).toBeLessThanOrEqual(97)
    expect(Math.round((plan.first + plan.step * 119) / 10_000)).toBeGreaterThanOrEqual(114)
    expect(Math.round((plan.first + plan.step * 119) / 10_000)).toBeLessThanOrEqual(117)
  })

  it('끝까지 굴리면 원금을 다 갚고, 원리금균등보다 이자가 많다', () => {
    const grad = loanTotalCost(300_000_000, g())
    const ann = loanTotalCost(300_000_000, loan({ rate: 3, months: 360 }))
    expect(grad.total - grad.interest).toBeGreaterThan(299_990_000)
    expect(grad.interest).toBeGreaterThan(ann.interest)
  })

  it('갚는 날이 지나면 다음 달 갚는 돈이 늘어난다', () => {
    const plan = graduatedPlan(300_000_000, 3, 360)
    const item = debt(300_000_000, g({ gradPayment: plan.first, gradStep: plan.step }))
    const after = catchUpLoan(item, new Date(2026, 10, 26))! // 10·11월 두 번
    expect(after.loan!.gradPayment).toBe(plan.first + plan.step * 2)
    expect(after.amount).toBeLessThan(300_000_000)
  })
})
