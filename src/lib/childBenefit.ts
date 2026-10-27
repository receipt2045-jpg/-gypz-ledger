/**
 * 아이 지원금 계산 (2026-10-27) — 부모급여·아동수당·가정양육수당을 앞으로 몇 달, 얼마나 더 받나.
 *
 * 부모급여: 태어난 달부터 0~11개월 월 100만, 12~23개월 월 50만. 어린이집에 다니면 보육료를 빼고 남는 현금만.
 * 아동수당: 2026년 만 9세 미만 → 해마다 1세씩 올라 2030년 13세 미만 (아동수당법 개정, 2026-03-20).
 *   생일이 든 달의 전달까지 받는다. 2017년생은 법이 바뀌기 전 끊겼다가 2026년 1월분부터 다시 받는다.
 *   사는 곳마다 금액이 다르다 — 수도권 10만, 비수도권 10.5만, 인구감소 우대 11만, 특별 12만(상품권이면 +1만).
 * 지금 금액이 그대로 간다고 보고 센다. 방향만 잡아주는 계산이다.
 */
import { RULES } from './parentalLeave'

export type Region = 'metro' | 'nonMetro' | 'declinePref' | 'declineSpecial'

export const BENEFIT_RULES = {
  /** 기준일 — 숫자를 고칠 때 같이 올린다 */
  updated: '2026-10-27',
  parentPay0: RULES.parentPay0,
  parentPay1: RULES.parentPay1,
  parentPayDaycare0: RULES.parentPayDaycare0,
  parentPayDaycare1: RULES.parentPayDaycare1,
  /** 가정양육수당: 어린이집·유치원 안 다니면 24~85개월 월 10만 */
  homeCare: RULES.homeCareAllowance,
  homeCareUntil: 86,
  allowance: {
    metro: 100_000,
    nonMetro: 105_000,
    declinePref: 110_000,
    declineSpecial: 120_000,
  } as Record<Region, number>,
  /** 인구감소지역에서 지역사랑상품권으로 받으면 더 주는 돈 */
  voucherBonus: 10_000,
  /** 첫만남이용권: 첫째 200만, 둘째부터 300만 (태어날 때 한 번) */
  firstMeet: { first: 2_000_000, more: 3_000_000 },
  /** 다달이 25일에 들어온다 */
  payDay: 25,
} as const

export const REGION_LABEL: Record<Region, string> = {
  metro: '수도권',
  nonMetro: '비수도권',
  declinePref: '인구감소 우대지역',
  declineSpecial: '인구감소 특별지역',
}

/** 그해 아동수당 나이 (만 N세 미만) — 2026년 9세, 해마다 1세씩, 2030년부터 13세 */
export function allowanceAge(year: number): number {
  if (year < 2026) return 8
  return Math.min(13, 9 + (year - 2026))
}

export interface BenefitInput {
  /** 'YYYY-MM-DD' 생일(또는 출산 예정일) */
  birth: string
  /** 몇째 */
  order: 1 | 2
  region: Region
  /** 인구감소지역에서 지역사랑상품권으로 받기 */
  voucher: boolean
  /** 어린이집(유치원)에 다니나 */
  daycare: boolean
}

export interface BenefitMonth {
  /** 'YYYY-MM' */
  ym: string
  /** 태어난 달 = 0 */
  age: number
  parentPay: number
  allowance: number
  homeCare: number
}

export interface BenefitLine {
  months: number
  total: number
  /** 마지막으로 받는 달 'YYYY-MM' (없으면 null) */
  lastYm: string | null
}

export interface BenefitPhase {
  from: string
  to: string
  months: number
  monthly: number
  parentPay: number
  allowance: number
  homeCare: number
}

export interface BenefitResult {
  /** 세기 시작한 달 'YYYY-MM' */
  startYm: string
  /** 아직 안 태어났으면 true */
  unborn: boolean
  months: BenefitMonth[]
  parentPay: BenefitLine
  allowance: BenefitLine
  homeCare: BenefitLine
  /** 첫만남이용권 — 아직 안 태어났을 때만 앞으로 받을 돈에 더한다 */
  firstMeet: number
  firstMeetAhead: boolean
  total: number
  phases: BenefitPhase[]
}

const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`

export function allowanceAmount(region: Region, voucher: boolean): number {
  const base = BENEFIT_RULES.allowance[region]
  const decline = region === 'declinePref' || region === 'declineSpecial'
  return base + (decline && voucher ? BENEFIT_RULES.voucherBonus : 0)
}

/** 그달에 아동수당을 받나. age = 태어난 달부터 센 개월 */
export function allowanceEligible(year: number, birthYear: number, age: number): boolean {
  const limit = allowanceAge(year)
  if (age < limit * 12) return true
  // 바뀌는 동안(2026~2029)은 2017년생처럼 그해 나이 기준에 드는 출생연도 전체가 받는다(복지부 2026-04-23)
  return year >= 2026 && year <= 2029 && birthYear >= year - limit
}

export function computeBenefit(input: BenefitInput, now: Date = new Date()): BenefitResult {
  const [by, bm] = input.birth.split('-').map(Number)
  // 이번 달 25일이 지났으면 이번 달 돈은 이미 들어왔다 — 다음 달부터 센다
  let y = now.getFullYear()
  let m = now.getMonth() + 1
  if (now.getDate() > BENEFIT_RULES.payDay) {
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  const unborn = by * 12 + bm > y * 12 + m
  if (unborn) {
    y = by
    m = bm
  }
  const startYm = ym(y, m)
  const allowanceMonthly = allowanceAmount(input.region, input.voucher)

  const months: BenefitMonth[] = []
  // 아동수당은 길어야 13세 — 넉넉히 14년까지만 본다
  for (let i = 0; i < 14 * 12; i++) {
    const age = (y - by) * 12 + (m - bm)
    if (age >= 0) {
      const parentPay =
        age < 12
          ? input.daycare
            ? BENEFIT_RULES.parentPayDaycare0
            : BENEFIT_RULES.parentPay0
          : age < 24
            ? input.daycare
              ? BENEFIT_RULES.parentPayDaycare1
              : BENEFIT_RULES.parentPay1
            : 0
      const homeCare =
        !input.daycare && age >= 24 && age < BENEFIT_RULES.homeCareUntil
          ? BENEFIT_RULES.homeCare
          : 0
      const allowance = allowanceEligible(y, by, age) ? allowanceMonthly : 0
      if (parentPay + homeCare + allowance === 0 && age >= 24) break
      months.push({ ym: ym(y, m), age, parentPay, allowance, homeCare })
    }
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }

  const line = (pick: (x: BenefitMonth) => number): BenefitLine => {
    const paid = months.filter((x) => pick(x) > 0)
    return {
      months: paid.length,
      total: paid.reduce((s, x) => s + pick(x), 0),
      lastYm: paid.length ? paid[paid.length - 1].ym : null,
    }
  }
  const parentPay = line((x) => x.parentPay)
  const allowance = line((x) => x.allowance)
  const homeCare = line((x) => x.homeCare)
  const firstMeet = input.order === 1 ? BENEFIT_RULES.firstMeet.first : BENEFIT_RULES.firstMeet.more

  const phases: BenefitPhase[] = []
  for (const x of months) {
    const last = phases[phases.length - 1]
    if (
      last &&
      last.parentPay === x.parentPay &&
      last.allowance === x.allowance &&
      last.homeCare === x.homeCare
    ) {
      last.to = x.ym
      last.months += 1
    } else {
      phases.push({
        from: x.ym,
        to: x.ym,
        months: 1,
        monthly: x.parentPay + x.allowance + x.homeCare,
        parentPay: x.parentPay,
        allowance: x.allowance,
        homeCare: x.homeCare,
      })
    }
  }

  return {
    startYm,
    unborn,
    months,
    parentPay,
    allowance,
    homeCare,
    firstMeet,
    firstMeetAhead: unborn,
    total: parentPay.total + allowance.total + homeCare.total + (unborn ? firstMeet : 0),
    phases: phases.filter((p) => p.monthly > 0),
  }
}

/** '2027-09' → '2027년 9월' */
export const ymLabel = (s: string) => `${s.slice(0, 4)}년 ${Number(s.slice(5, 7))}월`
