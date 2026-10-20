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
  region: 'dense',
  eup: false,
  regulated: false,
  area: '85',
  rateType: 'cycle',
  lender: 'bank',
  mortgageInsurance: false,
}
const loan = (i: LoanFinderInput, key: string) => {
  const r = findLoans(i)
  return [...r.loans, ...r.blocked].find((l) => l.key === key)!
}

describe('강의 예시와 맞는지', () => {
  it('29쪽 — 월 157만 · 30년 · 4.8% 원리금균등이면 약 3억', () => {
    near(principalFor(157 * MAN, 4.8, 30), 3 * EOK, 0.05 * EOK)
  })

  it('34쪽 — 연소득 5,000만 · DSR 40% · 금리 유형별 한도 계산식', () => {
    const yearly = (5_000 * MAN * 0.4) / 12
    near(principalFor(yearly, 4.9, 30), 3.1 * EOK, 0.06 * EOK)
    near(principalFor(yearly, 5.8, 30), 2.8 * EOK, 0.06 * EOK)
    near(principalFor(yearly, 7.0, 30), 2.4 * EOK, 0.11 * EOK) // 강의 '약 2억 4,000만' (계산값 2.5억)
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
  })

  it('방공제는 LTV 쪽에서만 뺀다 — DSR 한도는 그대로', () => {
    const withBang = loan({ ...base, region: 'seoul' }, 'general')
    const mci = loan({ ...base, region: 'seoul', mortgageInsurance: true }, 'general')
    expect(mci.parts[1].amount - withBang.parts[1].amount).toBe(5_500 * MAN)
    expect(mci.parts[2].amount).toBe(withBang.parts[2].amount)
  })
})

// 2026-10-20 공식 자료로 다시 맞춘 것
describe('최신 기준 (2026-10-20 확인)', () => {
  it('스트레스 DSR — 수도권 주기형 +1.2 · 혼합형 +2.4 · 변동 +3.0, 지방 주기형 +0.23', () => {
    expect(loan(base, 'general').parts[2].label).toContain('+1.20%p')
    expect(loan({ ...base, rateType: 'mix' }, 'general').parts[2].label).toContain('+2.40%p')
    expect(loan({ ...base, rateType: 'var' }, 'general').parts[2].label).toContain('+3.00%p')
    expect(loan({ ...base, region: 'city' }, 'general').parts[2].label).toContain('+0.23%p')
  })

  it('신생아 특례는 방공제가 없다', () => {
    const r = loan({ ...base, baby: true, region: 'seoul' }, 'baby')
    expect(r.parts[1].label).not.toContain('방공제')
  })

  it('디딤돌 방공제 — 수도권은 생애최초도 차감, 지방은 없음, 연소득 4천 이하·3억 이하는 예외', () => {
    expect(loan({ ...base, region: 'seoul' }, 'didim').parts[1].label).toContain('방공제 5,500만')
    expect(loan({ ...base, region: 'city' }, 'didim').parts[1].label).not.toContain('방공제')
    const cheap = loan(
      { ...base, income1: 2_000 * MAN, income2: 2_000 * MAN, deal: 3 * EOK, kb: 3 * EOK },
      'didim',
    )
    expect(cheap.parts[1].label).not.toContain('방공제')
  })

  it('디딤돌 금리 — 공식 표(30년): 8,300만은 4.15%, 지방은 −0.2%p', () => {
    expect(loan(base, 'didim').rate).toBe(4.15)
    near(loan({ ...base, region: 'city' }, 'didim').rate, 3.95, 1e-9)
  })

  it('신생아 특례 금리 — 공식 표(30년): 8,300만은 2.90%, 1.6억 맞벌이는 4.15%', () => {
    expect(loan({ ...base, baby: true }, 'baby').rate).toBe(2.9)
    expect(
      loan({ ...base, baby: true, income1: 8_000 * MAN, income2: 8_000 * MAN }, 'baby').rate,
    ).toBe(4.15)
  })

  it('신생아 특례 — 맞벌이는 합산 2억까지 (강의 57쪽)', () => {
    expect(
      loan({ ...base, baby: true, income1: 1.4 * EOK, income2: 0.5 * EOK }, 'baby').blockers,
    ).toHaveLength(0)
    expect(
      loan({ ...base, baby: true, income1: 1.4 * EOK, income2: 0.7 * EOK }, 'baby').blockers,
    ).toContain('부부 소득 2억 이하')
  })

  it('보금자리론 금리 — 10월 아낌e 만기별, 규제지역 +0.2%p', () => {
    expect(loan(base, 'bogeum').rate).toBe(5.15) // 체증식 40년
    near(loan({ ...base, regulated: true }, 'bogeum').rate, 5.35, 1e-9)
    expect(loan({ ...base, age: '50' }, 'bogeum').rate).toBe(5.1) // 30년
  })

  it('보금자리론 체증식 — 만 40세 미만만, 최대 40년 · 50년 대상이면 안내', () => {
    const young = loan(base, 'bogeum')
    expect(young.method).toBe('grad')
    expect(young.years).toBe(40)
    expect(young.note).toContain('50년은 원리금균등')
    const forties = loan({ ...base, age: '40' }, 'bogeum')
    expect(forties.method).toBe('ann')
    expect(forties.years).toBe(40) // 40대 신혼은 40년
    expect(forties.note).toContain('만 40세 미만만')
  })

  it('은행 생애최초 LTV — 수도권은 규제지역이 아니어도 70%, 지방 비규제는 80%', () => {
    expect(loan(base, 'general').parts[1].label).toContain('LTV 70%')
    expect(loan({ ...base, region: 'city' }, 'general').parts[1].label).toContain('LTV 80%')
  })

  it('방공제 지역 — 세종은 지방이어도 4,800만, 경기 그 밖은 2,800만으로', () => {
    expect(loan({ ...base, region: 'sejong' }, 'general').parts[1].label).toContain('4,800만')
    expect(loan({ ...base, region: 'gyeonggi' }, 'general').parts[1].label).toContain('2,800만')
  })
})

describe('상품별 조건', () => {
  it('보금자리론 — 시세나 매매가 하나라도 6억 넘으면 안 된다', () => {
    expect(loan({ ...base, deal: 6.2 * EOK, kb: 5.8 * EOK }, 'bogeum').blockers).toContain(
      '시세·매매가 모두 6억 이하',
    )
  })

  it('보금자리론 — 신혼은 합산 1.4억이어도 한 명이 7,000만 이하면 된다 (2026.10.19~)', () => {
    expect(
      loan({ ...base, income1: 8_000 * MAN, income2: 6_000 * MAN }, 'bogeum').blockers,
    ).toHaveLength(0)
  })

  it('보금자리론 — 50대는 30년', () => {
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
