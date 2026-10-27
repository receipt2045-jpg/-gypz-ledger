// ── 아이 앞으로 들어온 돈 (2026-10-27) ──
// 아동수당·지원금, 용돈·선물을 아이 이름으로 기록(confessions.child). 자산 탭에서 아이별로 모아 본다.
// 증여: 미성년 자녀가 부모·조부모(직계존속)에게 받은 돈은 10년간 합쳐 2,000만원까지 증여세가 없다.
// 이 앱은 '부모·조부모가 준 돈'으로 표시한 기록만 더해서 보여준다 — 참고용.
import { SUPPORT_INCOME } from './constants'

export const GIFT_LIMIT_MINOR = 20_000_000

export interface ChildRecord {
  child: string
  category: string
  amount: number
  childKeep: boolean
  gift: boolean
  createdAt: string
}

export interface ChildSummary {
  /** 올해 아이 앞으로 들어온 돈 */
  yearTotal: number
  yearSupport: number
  yearGift: number
  /** 올해 그중 아이 통장에 모은 돈 / 살림에 보탠 돈 */
  yearKept: number
  yearToHousehold: number
  /** 최근 10년 '부모·조부모가 준 돈' 합계 */
  gift10y: number
}

export function summarizeChild(
  records: ChildRecord[],
  child: string,
  now: Date = new Date(),
): ChildSummary {
  const year = String(now.getFullYear())
  const tenYearsAgo = new Date(now)
  tenYearsAgo.setFullYear(now.getFullYear() - 10)
  const out: ChildSummary = {
    yearTotal: 0,
    yearSupport: 0,
    yearGift: 0,
    yearKept: 0,
    yearToHousehold: 0,
    gift10y: 0,
  }
  for (const r of records) {
    if (r.child !== child || r.amount <= 0) continue
    const at = new Date(r.createdAt)
    if (r.createdAt.slice(0, 4) === year) {
      out.yearTotal += r.amount
      if (r.category === SUPPORT_INCOME) out.yearSupport += r.amount
      else out.yearGift += r.amount
      if (r.childKeep) out.yearKept += r.amount
      else out.yearToHousehold += r.amount
    }
    if (r.gift && at > tenYearsAgo) out.gift10y += r.amount
  }
  return out
}
