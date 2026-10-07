import type { AssetItem, BudgetItem } from '../types'

/**
 * 대출 상환 (2026-10-07 제보: "대출 이자율에 따른 매달 상환금이 자동으로 계산돼 자산에서 줄어드는 게 보이면 좋겠어요").
 *
 * 부채 항목에 금리·남은 기간·갚는 날·방식을 넣으면 매달 갚는 돈(이자·원금)을 계산하고,
 * 갚는 날이 지날 때마다 원금만큼 남은 대출을 줄인다(asOf 이후 지난 갚는 날만큼).
 */
export type LoanMethod = 'annuity' | 'principal' | 'graduated' | 'bullet'

export const LOAN_METHOD_LABEL: Record<LoanMethod, string> = {
  annuity: '원리금균등',
  principal: '원금균등',
  graduated: '체증식',
  bullet: '만기일시',
}

export interface LoanInfo {
  /** 연 금리(%) */
  rate: number
  /** 남은 기간(개월) */
  months: number
  /** 매달 갚는 날 1~31 (그 달에 없는 날이면 말일) */
  payDay: number
  method: LoanMethod
  /** 이 날짜까지는 남은 원금(amount)에 반영됨 'YYYY-MM-DD' — 이후 갚는 날부터 자동으로 줄인다 */
  asOf: string
  /** 가계부 고정지출 '대출 상환'에도 매달 채우기 */
  toLedger?: boolean
  /** 체증식 — 이번 달 갚는 돈(원리금)과 매달 늘어나는 금액. 없으면 남은 원금으로 다시 잡는다 */
  gradPayment?: number
  gradStep?: number
}

export interface LoanPayment {
  payment: number
  interest: number
  principal: number
}

const pad = (n: number) => String(n).padStart(2, '0')
export const dayString = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * 체증식 (2026-10-07) — 처음엔 적게 내고 원리금이 매달 같은 금액씩 늘어 만기에 다 갚는다.
 * 공사(HF)가 계산식을 공개하지 않아, 공개된 예시(3억·연 3%·30년 → 1개월 차 약 76만, 5년 차 96만, 10년 차 116만,
 * 만기 200만 넘게)에 맞춘 어림: 첫 달은 원리금균등의 60%(이자보다는 많게), 늘어나는 금액은 만기에 다 갚히게.
 */
export const GRADUATED_START_RATIO = 0.6

export function graduatedPlan(
  balance: number,
  ratePct: number,
  months: number,
): { first: number; step: number } {
  const n = Math.max(1, Math.round(months))
  const r = Math.max(0, ratePct) / 100 / 12
  let a = 0 // Σ v^k
  let ia = 0 // Σ (k−1) v^k
  for (let k = 1; k <= n; k++) {
    const v = Math.pow(1 + r, -k)
    a += v
    ia += (k - 1) * v
  }
  const annuity = balance / a
  const first = Math.max(annuity * GRADUATED_START_RATIO, balance * r + 1)
  const step = n > 1 ? (balance - first * a) / ia : 0
  return { first: Math.round(first), step: Math.max(0, Math.round(step)) }
}

/** 이번 달 갚는 돈 — 남은 원금·금리·남은 기간 기준 */
export function monthlyPayment(balance: number, loan: LoanInfo): LoanPayment {
  const n = Math.max(0, Math.round(loan.months))
  if (balance <= 0 || n === 0) return { payment: 0, interest: 0, principal: 0 }
  const r = Math.max(0, loan.rate) / 100 / 12
  const interest = Math.round(balance * r)
  let principal: number
  if (loan.method === 'graduated') {
    const pay = loan.gradPayment ?? graduatedPlan(balance, loan.rate, n).first
    principal = n === 1 ? balance : pay - interest
  } else if (loan.method === 'bullet') {
    principal = n === 1 ? balance : 0 // 만기에 한 번에
  } else if (loan.method === 'principal' || r === 0) {
    principal = Math.round(balance / n)
  } else {
    const payment = (balance * r) / (1 - Math.pow(1 + r, -n))
    principal = Math.round(payment - balance * r)
  }
  principal = Math.min(balance, Math.max(0, principal))
  return { payment: interest + principal, interest, principal }
}

/** 그 달의 갚는 날 (없는 날이면 말일) */
function payDateIn(y: number, m0: number, payDay: number): Date {
  const last = new Date(y, m0 + 1, 0).getDate()
  return new Date(y, m0, Math.min(payDay, last))
}

/** asOf 다음 날부터 today까지 지나간 갚는 날들 */
export function payDatesSince(asOf: string, today: Date, payDay: number): Date[] {
  const [y, m, d] = asOf.split('-').map(Number)
  const from = new Date(y, m - 1, d)
  const out: Date[] = []
  let cy = from.getFullYear()
  let cm = from.getMonth()
  for (let guard = 0; guard < 600; guard++) {
    const pd = payDateIn(cy, cm, payDay)
    if (pd > today) break
    if (pd > from) out.push(pd)
    cm += 1
    if (cm === 12) {
      cm = 0
      cy += 1
    }
  }
  return out
}

/** 한 달 갚은 뒤의 대출 정보 — 남은 기간 하나 줄이고, 체증식이면 다음 달 갚는 돈을 늘린다 */
function nextMonth(loan: LoanInfo, balanceAfter: number): LoanInfo {
  const months = loan.months - 1
  if (loan.method !== 'graduated') return { ...loan, months }
  const plan =
    loan.gradPayment === undefined || loan.gradStep === undefined
      ? graduatedPlan(balanceAfter, loan.rate, Math.max(1, months))
      : null
  return plan
    ? { ...loan, months, gradPayment: plan.first, gradStep: plan.step }
    : { ...loan, months, gradPayment: loan.gradPayment! + loan.gradStep! }
}

/** 지난 갚는 날만큼 원금을 줄인 항목. 바뀐 게 없으면 null */
export function catchUpLoan(item: AssetItem, today: Date): AssetItem | null {
  const loan = item.loan
  if (item.kind !== 'debt' || !loan) return null
  const dates = payDatesSince(loan.asOf, today, loan.payDay)
  if (dates.length === 0) return null
  let balance = item.amount
  let cur: LoanInfo = loan
  for (let i = 0; i < dates.length && balance > 0 && cur.months > 0; i++) {
    balance -= monthlyPayment(balance, cur).principal
    cur = nextMonth(cur, balance)
  }
  return {
    ...item,
    amount: Math.max(0, balance),
    loan: { ...cur, asOf: dayString(dates[dates.length - 1]) },
  }
}

/** 다 갚는 달 'YYYY-MM' — 다음 갚는 날부터 남은 기간만큼 */
export function payoffYm(loan: LoanInfo, today: Date): string | null {
  if (loan.months <= 0) return null
  const next = payDatesSince(
    dayString(today),
    new Date(today.getFullYear() + 1, today.getMonth() + 1, 1),
    loan.payDay,
  )[0]
  if (!next) return null
  const end = new Date(next.getFullYear(), next.getMonth() + loan.months - 1, 1)
  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}`
}

/** 대출 정보가 있는 부채들의 이번 달 합계 */
export function loanTotals(items: AssetItem[]): LoanPayment & { count: number } {
  const loans = items.filter((it) => it.kind === 'debt' && it.loan && it.amount > 0)
  return loans.reduce(
    (acc, it) => {
      const p = monthlyPayment(it.amount, it.loan!)
      return {
        payment: acc.payment + p.payment,
        interest: acc.interest + p.interest,
        principal: acc.principal + p.principal,
        count: acc.count + 1,
      }
    },
    { payment: 0, interest: 0, principal: 0, count: 0 },
  )
}

// ── 가계부 고정지출로 잇기 ──
export const LOAN_CATEGORY = '대출 상환'

/**
 * '가계부에도 넣기'를 켠 대출의 이번 달 갚는 돈 — 사람별 합계.
 * 아내 이름으로 된 대출은 아내 몫, 그 밖(남편·공동·자녀)은 구성원 1 몫으로 둔다.
 */
export function loanLedgerAmounts(assets: AssetItem[], member2Name: string): Map<1 | 2, number> {
  const out = new Map<1 | 2, number>()
  for (const it of assets) {
    if (it.kind !== 'debt' || !it.loan?.toLedger || it.amount <= 0) continue
    const m: 1 | 2 = it.owner === member2Name ? 2 : 1
    out.set(m, (out.get(m) ?? 0) + monthlyPayment(it.amount, it.loan).payment)
  }
  return out
}

/** 그 사람 몫 '대출 상환' 고정지출이 아직 없으면 이번 달 갚는 돈으로 하나 넣는다 (있으면 그대로 — 사용자가 고친 값 존중) */
export function addLoanItems(
  items: BudgetItem[],
  amounts: Map<1 | 2, number>,
  make: (member: 1 | 2, amount: number) => BudgetItem,
): BudgetItem[] {
  const add: BudgetItem[] = []
  for (const [m, amount] of amounts) {
    if (amount <= 0) continue
    const has = items.some(
      (it) => it.group === 'fixed' && it.category === LOAN_CATEGORY && it.member === m,
    )
    if (!has) add.push(make(m, amount))
  }
  return add.length ? [...items, ...add] : items
}

/**
 * 다 갚을 때까지 총 얼마 — 지금 남은 원금·기간 기준으로 끝까지 굴려 본다 (2026-10-07, 부상구 대출 계산기 참고).
 * 금리가 그대로라고 가정한다.
 */
export function loanTotalCost(
  balance: number,
  loan: LoanInfo,
): { total: number; interest: number } {
  let b = balance
  let cur: LoanInfo = { ...loan, months: Math.max(0, Math.round(loan.months)) }
  let interest = 0
  let total = 0
  while (b > 0 && cur.months > 0) {
    const p = monthlyPayment(b, cur)
    interest += p.interest
    total += p.payment
    b -= p.principal
    cur = nextMonth(cur, b)
  }
  return { total, interest }
}

/** 금리가 1%p 오르면 매달 갚는 돈 — 변동금리 위험을 한눈에 */
export function paymentIfRateUp(balance: number, loan: LoanInfo, up = 1): number {
  // 체증식은 오른 금리로 처음부터 다시 잡은 첫 달 기준
  return monthlyPayment(balance, {
    ...loan,
    rate: loan.rate + up,
    gradPayment: undefined,
    gradStep: undefined,
  }).payment
}
