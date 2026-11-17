/**
 * 코픽스 오르면 우리집 이자는 얼마 더? (2026-11-17) — 머니그랩 「코픽스」 툰의 댓글 자료.
 * 숫자는 여기 한 곳에. 화면은 pages/Cofix.tsx.
 */

import data from './cofixData.json'
import bank5y from './bank5yData.json'

export interface CofixMonth {
  /** 은행연합회 발표일 'YYYY-MM-DD' (보통 15일 무렵, 전달 코픽스) */
  published: string
  rate: number
  /** 앞 달 발표보다 바뀐 만큼(%p) — 내리면 음수 */
  change: number
}

/** 최신이 앞. GitHub Actions(cofix-update.yml)가 매달 scripts/update-cofix.mjs로 고친다 */
export const COFIX_MONTHS: CofixMonth[] = data.months

const month = (d: string) => Number(d.slice(5, 7))
const latest = COFIX_MONTHS[0]
const before = COFIX_MONTHS[1] ?? latest

/** 신규취급액 기준 코픽스 — 네이버 증권(은행연합회 공시) */
export const COFIX = {
  /** 발표한 달 (11월 16일 발표 → 11월) */
  publishedLabel: `${month(latest.published)}월`,
  publishedDay: `${month(latest.published)}월 ${Number(latest.published.slice(8, 10))}일`,
  /** 결영 11-17: "10월 코픽스 대신 11월로" — 발표한 달로 부른다 */
  nowLabel: `${month(latest.published)}월`,
  prevLabel: `${month(before.published)}월`,
  prev: before.rate,
  now: latest.rate,
  /** 이번 발표에서 바뀐 만큼(%p), 내리면 음수 */
  change: latest.change,
  updated: latest.published,
}

/**
 * 5년 고정형이 따라가는 금융채 5년 — 신한은행 주요시장금리, 매달 16일 값.
 * 은행은 소수 둘째 자리까지 쓰니 바뀐 만큼도 둘째 자리로 반올림한 두 값의 차이.
 */
const b0 = bank5y.months[0]
export const BANK5Y = {
  label: `${Number(b0.date.slice(5, 7))}월`,
  day: `${Number(b0.date.slice(5, 7))}월 ${Number(b0.date.slice(8, 10))}일`,
  rate: Math.round(b0.rate * 100) / 100,
  change: b0.change,
}

/** "+0.19%p" / "-0.10%p" / "0%p" */
export const pp = (n: number) => `${n > 0 ? '+' : ''}${Number(n.toFixed(3))}%p`

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

/** 오르는 만큼마다 한 달에 더 내는 돈 — 이번 발표 숫자를 끼워 넣는다 */
export const riseSteps = (latest: number) =>
  [...new Set([latest, 0.1, 0.25, 0.5, 1])].sort((a, b) => a - b)

/** 잔액마다 (카드 9장 표와 같은 줄) */
export const BALANCE_STEPS = [100_000_000, 200_000_000, 300_000_000, 400_000_000, 500_000_000, 600_000_000]
