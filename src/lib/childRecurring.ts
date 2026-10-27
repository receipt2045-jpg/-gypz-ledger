// ── 아이 앞으로 매달 들어오는 돈 (2026-10-27) ──
// 아동수당·부모급여처럼 매달 같은 날 들어오는 돈을 한 번 정해두면, 그날이 지나 앱을 열 때 그달 기록을 자동으로 적는다.
// 처음 정할 때 '언제부터'를 지난 달로 고르면 그 달부터 지금까지를 한 번에 넣는다.
// 기록 id는 (규칙, 달)로 정해진다 — 부부가 둘 다 앱을 열어도 같은 기록이 두 번 생기지 않는다.
// 아이 생일을 알면 부모급여는 돌 지나 금액이 바뀌고 두 돌에 끝나며, 아동수당은 받는 나이가 끝나면 멈춘다.
import type { ChildRecurring } from '../types'
import { BENEFIT_RULES, allowanceEligible } from './childBenefit'

export type { ChildRecurring }

export const RECURRING_KIND_LABEL: Record<ChildRecurring['kind'], string> = {
  allowance: '아동수당',
  parentPay: '부모급여',
  other: '다른 지원금',
}

export const RECURRING_DEFAULT_AMOUNT: Record<ChildRecurring['kind'], number> = {
  allowance: BENEFIT_RULES.allowance.metro,
  parentPay: BENEFIT_RULES.parentPay0,
  other: 0,
}

/** '2026-10' + n달 */
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const monthsBetween = (a: string, b: string) => {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

/** 그달 들어오는 날 (말일보다 크면 말일) */
export function payDate(ym: string, day: number): Date {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return new Date(y, m - 1, Math.min(day, last), 12)
}

/** 들어오는 날이 지난 마지막 달 */
export function lastDueYm(day: number, now: Date = new Date()): string {
  const ym = ymOf(now)
  const pay = payDate(ym, day)
  return now.getDate() >= pay.getDate() ? ym : addMonths(ym, -1)
}

/** 그달 금액. 0이면 그달은 안 들어온다(생일 기준으로 끝났거나 아직 안 태어났다) */
export function recurringAmount(rule: ChildRecurring, ym: string, birth?: string): number {
  if (!birth || rule.kind === 'other') return rule.amount
  const age = monthsBetween(birth.slice(0, 7), ym) // 태어난 달 = 0
  if (age < 0) return 0
  if (rule.kind === 'parentPay') {
    if (age < 12) return rule.amount
    if (age < 24) return rule.amountAfter1 ?? BENEFIT_RULES.parentPay1
    return 0
  }
  return allowanceEligible(Number(ym.slice(0, 4)), Number(birth.slice(0, 4)), age) ? rule.amount : 0
}

export interface DueMonth {
  ym: string
  amount: number
  skipped: boolean
}

/**
 * 시작 달부터 들어오는 날이 지난 달까지. doneYm이 있으면 그다음 달부터.
 * skipped는 '받지 않은 달'로 뺀 달(미리보기에서 보여주려고 남긴다). 금액 0인 달은 아예 뺀다.
 */
export function dueMonths(
  rule: ChildRecurring,
  birth: string | undefined,
  now: Date = new Date(),
): DueMonth[] {
  let end = lastDueYm(rule.day, now)
  if (rule.stoppedYm && rule.stoppedYm < end) end = rule.stoppedYm
  let ym = rule.doneYm && rule.doneYm >= rule.startYm ? addMonths(rule.doneYm, 1) : rule.startYm
  const out: DueMonth[] = []
  // 아무리 길어도 20년
  for (let i = 0; ym <= end && i < 240; i++, ym = addMonths(ym, 1)) {
    const amount = recurringAmount(rule, ym, birth)
    if (amount > 0) out.push({ ym, amount, skipped: !!rule.skip?.includes(ym) })
  }
  return out
}

/** 다음에 적힐 달·날 — 끝났거나 멈췄으면 null */
export function nextPay(
  rule: ChildRecurring,
  birth: string | undefined,
  now: Date = new Date(),
): { ym: string; amount: number; date: Date } | null {
  if (rule.stoppedYm) return null
  let ym = addMonths(lastDueYm(rule.day, now), 1)
  if (ym < rule.startYm) ym = rule.startYm
  for (let i = 0; i < 240; i++, ym = addMonths(ym, 1)) {
    const amount = recurringAmount(rule, ym, birth)
    if (amount > 0) return { ym, amount, date: payDate(ym, rule.day) }
  }
  return null
}

/** (규칙, 달) → 늘 같은 uuid 모양 id */
export function recurringId(ruleId: string, ym: string): string {
  const src = `${ruleId}:${ym}`
  const parts: string[] = []
  for (let seed = 0; seed < 4; seed++) {
    let h = 0x811c9dc5 ^ (seed * 0x9e3779b9)
    for (let i = 0; i < src.length; i++) {
      h ^= src.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
    parts.push((h >>> 0).toString(16).padStart(8, '0'))
  }
  const hex = parts.join('')
  // uuid v4 모양(버전·변형 자리)을 맞춘다 — DB id 칸이 uuid
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** 이 기록이 매달 자동으로 적힌 것인가 */
export function isRecurringRecord(id: string, createdAt: string, rules: ChildRecurring[]): boolean {
  const ym = ymOf(new Date(createdAt))
  return rules.some((r) => recurringId(r.id, ym) === id)
}
