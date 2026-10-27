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

// ── 증여 신고 기록 (2026-10-27) ──
// 홈택스에 증여세 신고를 했는지 아이별로 남긴다. 한 번에(일시) 신고했는지, 매달 정해진 돈을
// 주기로 하고 한 번에 신고(유기정기금)했는지도. 정기금은 계약한 전체 금액을 적는다.
export type GiftReportKind = 'lump' | 'periodic'

export interface GiftReport {
  id: string
  child: string
  /** 'YYYY-MM-DD' 신고한 날 */
  reportedOn: string
  /** 신고한 증여 금액 (정기금은 계약한 전체 금액) */
  amount: number
  kind: GiftReportKind
  note?: string
}

export const GIFT_REPORT_KIND_LABEL: Record<GiftReportKind, string> = {
  lump: '한 번에',
  periodic: '정기금',
}

/** 최근 10년 신고한 돈과, 증여로 기록했지만 아직 신고 안 한 돈 */
export function giftReportStatus(
  reports: GiftReport[],
  child: string,
  gift10y: number,
  now: Date = new Date(),
): { reported: number; unreported: number } {
  const tenYearsAgo = new Date(now)
  tenYearsAgo.setFullYear(now.getFullYear() - 10)
  const reported = reports
    .filter((r) => r.child === child && new Date(`${r.reportedOn}T12:00:00`) > tenYearsAgo)
    .reduce((sum, r) => sum + r.amount, 0)
  return { reported, unreported: Math.max(0, gift10y - reported) }
}

/**
 * 유기정기금 평가액 — 매달 같은 돈을 정해진 해 동안 주기로 하고 처음에 한 번 신고하면,
 * 해마다 받을 돈을 연 3%로 깎아 지금 가치로 더한 값을 증여한 돈으로 본다(상증법 시행령 62조).
 * 첫해 몫도 1년 깎아서 센다 — 세무서·세무사마다 계산이 조금 다를 수 있어 참고용.
 */
export const PERIODIC_RATE = 0.03

export function periodicGiftValue(monthly: number, years: number): number {
  let sum = 0
  for (let k = 1; k <= years; k++) sum += (monthly * 12) / (1 + PERIODIC_RATE) ** k
  return Math.round(sum)
}

/** 평가액이 공제(미성년 2,000만) 안에 들어가는 월 최대 금액 — 천 원 단위로 내림 */
export function periodicMaxMonthly(years: number, limit = GIFT_LIMIT_MINOR): number {
  let factor = 0
  for (let k = 1; k <= years; k++) factor += 12 / (1 + PERIODIC_RATE) ** k
  return Math.floor(limit / factor / 1000) * 1000
}
