/**
 * 코픽스 오르면 우리집 이자는 얼마 더? (2026-11-17) — 머니그랩 「코픽스」 툰의 댓글 자료.
 * 숫자는 여기 한 곳에. 화면은 pages/Cofix.tsx.
 */

export const COFIX = {
  /** 신규취급액 기준 코픽스 — 머니그랩 카페 글(1638) 기준 */
  prevLabel: '9월',
  prev: 3.43,
  nowLabel: '10월',
  now: 3.62,
  /** 두 달 새 오른 폭 */
  twoMonthRise: 0.44,
  updated: '2026-11-17',
}

export type RepayKind = 'amortized' | 'interestOnly'

export interface CofixInput {
  /** 남은 대출금(원) */
  balance: number
  /** 지금 금리(연 %) */
  rate: number
  /** 오르는 폭(%포인트) */
  rise: number
  /** 남은 기간(년) */
  years: number
  repay: RepayKind
}

/** 한 달에 내는 돈(원). 원리금균등이면 원금+이자, 이자만이면 이자 */
export function monthlyPay(balance: number, ratePct: number, years: number, repay: RepayKind): number {
  if (balance <= 0) return 0
  const r = ratePct / 100 / 12
  if (repay === 'interestOnly') return balance * r
  const n = Math.max(1, Math.round(years * 12))
  if (r === 0) return balance / n
  return (balance * r) / (1 - Math.pow(1 + r, -n))
}

export interface CofixResult {
  before: number
  after: number
  /** 한 달에 더 내는 돈 */
  diff: number
  /** 1년이면 */
  diffYear: number
  /** 카드와 같은 단순 계산: 잔액 × 오르는 폭 ÷ 12 */
  simple: number
}

export function computeCofix(v: CofixInput): CofixResult {
  const before = monthlyPay(v.balance, v.rate, v.years, v.repay)
  const after = monthlyPay(v.balance, v.rate + v.rise, v.years, v.repay)
  const diff = after - before
  return { before, after, diff, diffYear: diff * 12, simple: (v.balance * v.rise) / 100 / 12 }
}

/** 오르는 폭마다 한 달에 더 내는 돈 */
export const RISE_STEPS = [0.1, 0.19, 0.25, 0.44, 0.5, 1]

/** 잔액마다 (카드 9장 표와 같은 줄) */
export const BALANCE_STEPS = [100_000_000, 200_000_000, 300_000_000, 400_000_000, 500_000_000, 600_000_000]
