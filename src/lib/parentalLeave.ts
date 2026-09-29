/**
 * 육아휴직 시뮬레이션 — "애 낳기 전이 골든타임"을 우리 집 숫자로 확인한다.
 *
 * 지금(아이 없이 둘 다 일할 때) 매달 모으는 돈과, 휴직 중 달마다 모이는 돈을 나란히 본다.
 * 평균을 내지 않는다(2026-09-29 결정) — 달마다 실제로 오가는 돈으로만 보여준다.
 * 고정비·변동비는 지금 그대로 쓴다고 본다. 아이가 태어나자마자 휴직을 시작한다고 본다.
 * 세무·법률 판단이 아니라 방향만 잡아주는 계산이고, 기본값은 화면에서 모두 고칠 수 있다.
 */

export const LEAVE_SAVE_KEY = 'moabuli.leaveSim.v2'

export const RULES = {
  /** 기준일 — 숫자를 고칠 때 같이 올린다 */
  updated: '2026-09-29',
  /** 육아휴직급여 하한 (월) */
  payFloor: 700_000,
  /** 한 명만 쉴 때 상한: 1~3개월 / 4~6개월 / 7개월~(통상임금 80%) */
  capFirst3: 2_500_000,
  capNext3: 2_000_000,
  capAfter: 1_600_000,
  afterRate: 0.8,
  /** 부부가 둘 다 쉴 때(6+6) 각자 첫 6개월 상한 — 통상임금 100% */
  cap66: [2_500_000, 2_500_000, 3_000_000, 3_500_000, 4_000_000, 4_500_000],
  /** 부모급여: 만 0세(0~11개월) / 만 1세(12~23개월) */
  parentPay0: 1_000_000,
  parentPay1: 500_000,
  /** 어린이집에 다니면 보육료를 빼고 남는 현금. 0세 = 100만 − 기본보육료 58.4만, 1세는 남는 게 없다 */
  parentPayDaycare0: 416_000,
  parentPayDaycare1: 0,
  /** 두 돌 뒤(24개월~)엔 부모급여가 끝나고, 집에서 보면 가정양육수당 월 10만원 */
  homeCareAllowance: 100_000,
  /** 아동수당 (만 9세 미만) */
  childAllowance: 100_000,
  /**
   * 가구당 양육비용 — 육아정책연구소 'KICCE 소비실태조사 2025'(7차년도, 2024년) 149.8만원.
   * 가구 안 모든 자녀에게 든 돈의 합이라 첫아이만 있는 집은 이보다 적을 수 있다.
   */
  childCostDefault: 1_500_000,
} as const

export type Who = 'wife' | 'husband' | 'both'
export type Order = 'seq' | 'sim'
/** 어린이집을 몇 개월째부터 보내나. 0 = 안 보낸다 */
export type DaycareFrom = 0 | 7 | 13

/**
 * 한 사람이 쉴 수 있는 기간. 한 명만 쉬면 12개월까지,
 * 부부가 각자 3개월 이상 쉬면 한 사람당 18개월까지 (2025-02 개정, 늘어난 6개월도 유급).
 */
export const MONTH_OPTIONS_SOLO = [3, 6, 12] as const
export const MONTH_OPTIONS_BOTH = [3, 6, 12, 18] as const
const MAX_SOLO = 12
/** 6+6 특례: 아이가 태어난 지 18개월 안에 부부가 둘 다 휴직을 시작해야 한다 */
const SIX_SIX_WITHIN = 18

export interface LeaveInput {
  /** 아내 월 실수령 */
  payWife: number
  /** 남편 월 실수령 */
  payHusband: number
  /** 월 고정비 */
  fixed: number
  /** 월 변동비 */
  variable: number
  /** 누가 쉬나 */
  who: Who
  monthsWife: number
  monthsHusband: number
  /** 둘 다 쉴 때: 번갈아(아내 먼저) / 같이 */
  order: Order
  /** 늘어나는 양육비 (월) */
  childCost: number
  daycareFrom: DaycareFrom
}

/** 처음 열었을 때 결과가 바로 보이도록 예시 숫자로 채워 둔다 */
export const DEFAULT_INPUT: LeaveInput = {
  payWife: 2_500_000,
  payHusband: 2_700_000,
  fixed: 1_800_000,
  variable: 1_800_000,
  who: 'wife',
  monthsWife: 12,
  monthsHusband: 12,
  order: 'seq',
  childCost: RULES.childCostDefault,
  daycareFrom: 0,
}

export function readLeaveInput(): LeaveInput {
  try {
    const raw = localStorage.getItem(LEAVE_SAVE_KEY)
    if (!raw) return DEFAULT_INPUT
    return { ...DEFAULT_INPUT, ...(JSON.parse(raw) as Partial<LeaveInput>) }
  } catch {
    return DEFAULT_INPUT
  }
}

/**
 * 휴직 k번째 달의 육아휴직급여.
 * 법정 기준은 통상임금(세전)인데 입력은 실수령이라, 실제로는 이보다 같거나 조금 많다.
 */
export function leavePayAt(k: number, pay: number, bothParents: boolean): number {
  if (pay <= 0) return 0
  let v: number
  if (bothParents && k <= 6) v = Math.min(pay, RULES.cap66[k - 1])
  else if (k <= 3) v = Math.min(pay, RULES.capFirst3)
  else if (k <= 6) v = Math.min(pay, RULES.capNext3)
  else v = Math.min(Math.round(pay * RULES.afterRate), RULES.capAfter)
  return Math.max(RULES.payFloor, v)
}

/** 아이가 태어난 지 t번째 달에 나라에서 현금으로 들어오는 돈 (부모급여·양육수당 + 아동수당) */
export function govAt(t: number, daycareFrom: DaycareFrom): number {
  const age0 = t <= 12
  const daycare = daycareFrom > 0 && t >= daycareFrom
  if (t > 24) return (daycare ? 0 : RULES.homeCareAllowance) + RULES.childAllowance
  const parentPay = age0
    ? daycare
      ? RULES.parentPayDaycare0
      : RULES.parentPay0
    : daycare
      ? RULES.parentPayDaycare1
      : RULES.parentPay1
  return parentPay + RULES.childAllowance
}

export interface LeaveMonth {
  /** 아이가 태어난 지 몇 번째 달 (1부터) */
  t: number
  wifeOnLeave: boolean
  husbandOnLeave: boolean
  /** 그달 아내 몫 수입 — 휴직 중이면 육아휴직급여 */
  wife: number
  husband: number
  /** 부모급여 + 아동수당 */
  gov: number
  /** 고정비 + 변동비 */
  spend: number
  childCost: number
  /** 그달 모이는 돈 (음수면 적자) */
  saved: number
}

/** 같은 숫자가 이어지는 달을 한 칸으로 묶은 것 */
export interface LeaveRun {
  from: number
  to: number
  month: LeaveMonth
}

export interface LeaveResult {
  /** 지금 매달 모으는 돈 */
  monthlyNow: number
  months: LeaveMonth[]
  runs: LeaveRun[]
}

/** 한 명만 쉬면 18개월을 골라 뒀어도 12개월로 본다 */
export function effectiveMonths(v: LeaveInput): { monthsWife: number; monthsHusband: number } {
  const cap = v.who === 'both' ? Infinity : MAX_SOLO
  return { monthsWife: Math.min(v.monthsWife, cap), monthsHusband: Math.min(v.monthsHusband, cap) }
}

function leaveWindows(input: LeaveInput): { wife: [number, number] | null; husband: [number, number] | null } {
  const { who, order } = input
  const { monthsWife, monthsHusband } = effectiveMonths(input)
  const wife: [number, number] | null = who === 'husband' ? null : [1, monthsWife]
  let husband: [number, number] | null = null
  if (who === 'husband') husband = [1, monthsHusband]
  else if (who === 'both')
    husband = order === 'seq' ? [monthsWife + 1, monthsWife + monthsHusband] : [1, monthsHusband]
  return { wife, husband }
}

const inWin = (w: [number, number] | null, t: number) => !!w && t >= w[0] && t <= w[1]
const man = (n: number) => Math.round(n / 10_000)

export function simulate(v: LeaveInput): LeaveResult {
  const spend = v.fixed + v.variable
  const monthlyNow = v.payWife + v.payHusband - spend
  const win = leaveWindows(v)
  // 6+6은 둘 다 18개월 안에 휴직을 시작할 때만. 아내가 18개월 쉬고 남편이 이어 쉬면 해당이 없다
  const both =
    v.who === 'both' && !!win.husband && !!win.wife && Math.max(win.wife[0], win.husband[0]) <= SIX_SIX_WITHIN
  const last = Math.max(win.wife?.[1] ?? 0, win.husband?.[1] ?? 0)

  const months: LeaveMonth[] = []
  for (let t = 1; t <= last; t++) {
    const wOn = inWin(win.wife, t)
    const hOn = inWin(win.husband, t)
    const wife = wOn ? leavePayAt(t - win.wife![0] + 1, v.payWife, both) : v.payWife
    const husband = hOn ? leavePayAt(t - win.husband![0] + 1, v.payHusband, both) : v.payHusband
    const gov = govAt(t, v.daycareFrom)
    months.push({
      t,
      wifeOnLeave: wOn,
      husbandOnLeave: hOn,
      wife,
      husband,
      gov,
      spend,
      childCost: v.childCost,
      saved: wife + husband + gov - spend - v.childCost,
    })
  }

  // 화면에 만원 단위로 같게 보이는 달은 한 칸으로 묶는다
  const key = (m: LeaveMonth) =>
    [m.wifeOnLeave, m.husbandOnLeave, man(m.wife), man(m.husband), man(m.gov), man(m.saved)].join('|')
  const runs: LeaveRun[] = []
  for (const m of months) {
    const prev = runs[runs.length - 1]
    if (prev && key(prev.month) === key(m)) prev.to = m.t
    else runs.push({ from: m.t, to: m.t, month: m })
  }

  return { monthlyNow, months, runs }
}
