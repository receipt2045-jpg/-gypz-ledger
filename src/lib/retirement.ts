/**
 * 노후 준비 계산기 (2026-10-07, 라떼비버 노후연금 계산기의 기능을 우리 방식으로).
 * 매달 같은 돈을 모으고 매달 복리로 불린다고 가정한다. 물가는 넣지 않는다(화면에 적어 둔다).
 */
export interface RetireInput {
  /** 지금 나이 */
  age: number
  /** 은퇴 나이 */
  retireAge: number
  /** 지금까지 모인 노후 자산(원) — 연금 자산 */
  start: number
  /** 연 수익률(%) — 모으는 동안 */
  rate: number
  /** 연 수익률(%) — 은퇴 뒤 */
  postRate: number
  /** 몇 살까지 쓸지 */
  lifeAge: number
}

const mr = (pct: number) => Math.max(0, pct) / 100 / 12

/** n개월 뒤 모이는 돈 */
function futureValue(start: number, monthly: number, ratePct: number, n: number): number {
  const r = mr(ratePct)
  if (r === 0) return start + monthly * n
  const g = Math.pow(1 + r, n)
  return start * g + (monthly * (g - 1)) / r
}

/** 은퇴 뒤 매달 쓸 수 있는 돈 — 원금을 남기면 이자만, 다 쓰면 기간 동안 나눠 */
export function spendable(balance: number, input: RetireInput): { keep: number; useUp: number } {
  const r = mr(input.postRate)
  const n = Math.max(1, (input.lifeAge - input.retireAge) * 12)
  const keep = balance * r
  const useUp = r === 0 ? balance / n : (balance * r) / (1 - Math.pow(1 + r, -n))
  return { keep: Math.round(keep), useUp: Math.round(useUp) }
}

export interface YearPoint {
  age: number
  balance: number
  /** 그때까지 내가 넣은 돈(원금) */
  paid: number
}

/** 지금 모으면 → 은퇴할 때 얼마, 노후에 매달 얼마 */
export function forward(input: RetireInput, monthly: number) {
  const years = Math.max(0, input.retireAge - input.age)
  const series: YearPoint[] = []
  for (let y = 0; y <= years; y++) {
    series.push({
      age: input.age + y,
      balance: Math.round(futureValue(input.start, monthly, input.rate, y * 12)),
      paid: input.start + monthly * y * 12,
    })
  }
  const balance = series[series.length - 1].balance
  return { balance, series, ...spendable(balance, input) }
}

/** 노후에 매달 이만큼 쓰려면 → 은퇴할 때 얼마가 있어야 하고, 지금부터 매달 얼마씩 */
export function reverse(input: RetireInput, wantMonthly: number) {
  const r = mr(input.postRate)
  const n = Math.max(1, (input.lifeAge - input.retireAge) * 12)
  const needKeep = r === 0 ? Infinity : wantMonthly / r
  const needUseUp = r === 0 ? wantMonthly * n : (wantMonthly * (1 - Math.pow(1 + r, -n))) / r
  const months = Math.max(0, (input.retireAge - input.age) * 12)
  const saving = (need: number) => {
    if (!Number.isFinite(need)) return null
    const fromStart = futureValue(input.start, 0, input.rate, months)
    const gap = need - fromStart
    if (gap <= 0) return 0
    if (months === 0) return null
    const rr = mr(input.rate)
    const factor = rr === 0 ? months : (Math.pow(1 + rr, months) - 1) / rr
    return Math.round(gap / factor)
  }
  return {
    needKeep: Number.isFinite(needKeep) ? Math.round(needKeep) : null,
    needUseUp: Math.round(needUseUp),
    monthlyKeep: saving(needKeep),
    monthlyUseUp: saving(needUseUp),
  }
}
