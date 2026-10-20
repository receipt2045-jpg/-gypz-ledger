import { describe, expect, it } from 'vitest'
import { findLoans, principalFor, repaymentPlans, type LoanFinderInput } from './homeLoan'

const MAN = 10_000
const EOK = 100_000_000
const near = (actual: number, expected: number, tol: number) =>
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol)

const base: LoanFinderInput = {
  income1: 4_500 * MAN,
  income2: 3_800 * MAN,
  own: 1.5 * EOK,
  monthly: 150 * MAN,
  age: '35',
  home: 'none',
  first: true,
  newly: true,
  baby: false,
  assetOk: true,
  worker: true,
  kids: 0,
  deal: 5 * EOK,
  kb: 4.9 * EOK,
  publicPrice: 0,
  region: 'metro',
  eup: false,
  regulated: false,
  overheated: false,
  area: '85',
  rateType: 'cycle',
  lender: 'bank',
  mortgageInsurance: false,
}
const loan = (i: LoanFinderInput, key: string) =>
  [...findLoans(i).loans, ...findLoans(i).blocked].find((l) => l.key === key)!

describe('강의 예시와 맞는지', () => {
  it('29쪽 — 월 157만 · 30년 · 4.8% 원리금균등이면 약 3억', () => {
    near(principalFor(157 * MAN, 4.8, 30), 3 * EOK, 0.05 * EOK)
  })

  it('34쪽 — 연소득 5,000만 · DSR 40% · 금리 유형별 한도 (주기형 3.1억 · 혼합형 2.8억 · 변동형 2.4억)', () => {
    const yearly = (5_000 * MAN * 0.4) / 12
    near(principalFor(yearly, 4.9, 30), 3.1 * EOK, 0.06 * EOK)
    near(principalFor(yearly, 5.8, 30), 2.8 * EOK, 0.06 * EOK)
    near(principalFor(yearly, 7.0, 30), 2.4 * EOK, 0.11 * EOK) // 강의는 '약 2억 4,000만' (계산값 2.5억)
  })

  it('41쪽 — 서울 10억 · LTV 70%에서 방공제 5,500만을 빼면 6억 4,500만', () => {
    const r = loan(
      { ...base, region: 'seoul', deal: 10 * EOK, kb: 10 * EOK, first: false, regulated: false },
      'general',
    )
    expect(r.parts[1].amount).toBe(6.45 * EOK)
  })

  it('43~45쪽 — 서울 9억 생애최초: 지역 6억 · LTV 6.3억−방공제=5.75억 · 최종은 셋 중 가장 작은 DSR', () => {
    const r = loan(
      {
        ...base,
        income1: 6_000 * MAN,
        income2: 0,
        region: 'seoul',
        regulated: true,
        deal: 9 * EOK,
        kb: 9 * EOK,
      },
      'general',
    )
    expect(r.parts[0].amount).toBe(6 * EOK)
    expect(r.parts[1].amount).toBe(5.75 * EOK)
    expect(r.limit).toBe(r.parts[2].amount) // 소득이 낮으면 방공제보다 DSR이 먼저 막는다
    expect(r.limit).toBeLessThan(5.75 * EOK)
  })

  it('방공제는 LTV 쪽에서만 뺀다 — DSR 한도는 그대로', () => {
    const withBang = loan({ ...base, region: 'seoul' }, 'general')
    const mci = loan({ ...base, region: 'seoul', mortgageInsurance: true }, 'general')
    expect(mci.parts[1].amount - withBang.parts[1].amount).toBe(5_500 * MAN)
    expect(mci.parts[2].amount).toBe(withBang.parts[2].amount)
  })
})

describe('상품별 조건', () => {
  it('보금자리론 — 매매가나 KB시세 하나라도 6억 넘으면 안 된다', () => {
    expect(loan({ ...base, deal: 6.2 * EOK, kb: 5.8 * EOK }, 'bogeum').blockers).toContain(
      '매매가·KB시세 둘 다 6억 이하',
    )
  })

  it("보금자리론 — 결혼 페널티 해소('26.10~): 합산 1.4억이어도 한 명이 7,000만 이하면 된다", () => {
    const r = loan({ ...base, income1: 8_000 * MAN, income2: 6_000 * MAN }, 'bogeum')
    expect(r.blockers).toHaveLength(0)
  })

  it('보금자리론 — 50년이 되는 집도 체증식은 최대 40년, 50년은 원리금균등만이라고 알린다', () => {
    const r = loan({ ...base, age: '35' }, 'bogeum')
    expect(r.method).toBe('grad')
    expect(r.years).toBe(40)
    expect(r.note).toContain('50년은 원리금균등')
  })

  it('보금자리론 — 40대 신혼은 40년, 50대는 30년', () => {
    expect(loan({ ...base, age: '40' }, 'bogeum').years).toBe(40)
    expect(loan({ ...base, age: '50' }, 'bogeum').years).toBe(30)
  })

  it('신생아 특례는 2년 안에 출산해야, 집값 9억까지', () => {
    expect(loan(base, 'baby').blockers[0]).toContain('출산')
    expect(loan({ ...base, baby: true, deal: 8 * EOK, kb: 8 * EOK }, 'baby').blockers).toHaveLength(
      0,
    )
  })

  it('디딤돌 — 신혼부부 소득 8,500만 넘으면 안 된다', () => {
    expect(loan(base, 'didim').blockers).toHaveLength(0) // 8,300만
    expect(loan({ ...base, income1: 5_000 * MAN }, 'didim').blockers.join()).toContain('8,500만')
  })

  it('보험사 주담대 — 방공제 없고 DSR 50%', () => {
    const ins = loan({ ...base, lender: 'ins' }, 'general')
    expect(ins.parts[1].label).not.toContain('방공제')
    expect(ins.parts[2].label).toContain('DSR 50%')
    expect(loan({ ...base, lender: 'ins', overheated: true }, 'general').parts[2].label).toContain(
      'DSR 40%',
    )
  })

  it('장래소득 — 30~34세 무주택 근로소득자는 소득을 17.8% 더 쳐준다', () => {
    const r30 = loan({ ...base, age: '30' }, 'general')
    const r35 = loan({ ...base, age: '35' }, 'general')
    near(r30.parts[2].amount / r35.parts[2].amount, 1.178, 0.001)
  })
})

describe('결과', () => {
  it('유리한 순 — 필요한 만큼 나오는 대출이 먼저, 그다음 첫 달 갚는 돈이 적은 순', () => {
    const r = findLoans(base)
    const enough = r.loans.filter((l) => l.enough)
    expect(r.loans.slice(0, enough.length)).toEqual(enough)
    for (let k = 1; k < enough.length; k++)
      expect(enough[k].firstPayment).toBeGreaterThanOrEqual(enough[k - 1].firstPayment)
  })

  it('상환 방식 — 첫 달은 체증식이 가장 적고, 총 이자는 원금균등이 가장 적다 (강의 50쪽)', () => {
    const p = repaymentPlans(3.6 * EOK, 4.85, 40)
    expect(p.grad.first).toBeLessThan(p.ann.first)
    expect(p.ann.first).toBeLessThan(p.prin.first)
    expect(p.prin.interest).toBeLessThan(p.ann.interest)
    expect(p.ann.interest).toBeLessThan(p.grad.interest)
  })

  it('소득공제 — 기준시가 6억 넘으면 없다 (공시가 없으면 KB시세 × 70%)', () => {
    expect(loan(base, 'bogeum').deduction).toBe(2_000 * MAN)
    expect(loan({ ...base, kb: 9 * EOK, deal: 9 * EOK }, 'general').deduction).toBe(0)
    expect(loan({ ...base, worker: false }, 'bogeum').deduction).toBe(0)
  })
})
