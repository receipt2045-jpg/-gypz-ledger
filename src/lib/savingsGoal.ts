import { shiftYm } from './format'

/**
 * 모을 돈 로드맵 — "얼마를 언제까지"에 지금 속도를 대 보는 산수.
 *
 * 집값·금리·수익률 같은 모르는 숫자는 하나도 안 넣는다. 들어가는 건
 * 사용자가 정한 목표(금액·시점), 정산에서 나온 월 저축 속도, 지금 자산뿐이다.
 * 그래서 이 계산은 틀릴 데가 없다 — 단서는 "같은 속도라면" 하나다.
 */

export interface Goal {
  amount: number // 목표 금액(원)
  targetYm: string // 'YYYY-MM' — 이 달 안에
  name?: string
}

export interface Pace {
  monthlySaving: number // 월 저축+투자 (정산 기준)
  monthlySide: number // 월 부수입 — 따로 보여주려고 나눠 받는다
}

export type GoalStatus = 'on' | 'slight' | 'off'

export interface GoalPlan {
  monthsLeft: number // 지금 → 목표 달 (0 이상)
  monthlyPace: number // 저축 + 부수입
  projected: number // 목표 달에 모여 있을 돈 (같은 속도라면)
  gap: number // 목표 − projected. 양수면 모자람
  progress: number // 지금까지 / 목표 (0~1)
  extraPerMonth: number | null // 모자람을 메우려면 월 얼마 더 (만원 단위 올림). 남은 달이 0이면 null
  reachYm: string | null // 지금 속도로 닿는 달. 속도가 0이면 null
  delayMonths: number | null // 목표 달보다 몇 달 늦나 (0이면 제때). 속도가 0이면 null
  status: GoalStatus
  yearly: { ym: string; value: number }[] // 지금·1년·2년…·목표 달
}

/** 'YYYY-MM' 두 개 사이 달 수 (from → to). 과거면 음수 */
export function monthsBetween(fromYm: string, toYm: string): number {
  const [fy, fm] = fromYm.split('-').map(Number)
  const [ty, tm] = toYm.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

/** 만원 단위 올림 — "월 137만 3,400원 더"는 아무도 못 지킨다 */
const ceilMan = (won: number) => Math.ceil(won / 10_000) * 10_000

/**
 * 상태 기준.
 * 12개월은 "한 해 계획을 다시 짜면 따라잡을 수 있는 폭"이다.
 * 그보다 늦으면 목표 자체를 다시 봐야 한다.
 */
const SLIGHT_LIMIT = 12

export function planGoal(have: number, goal: Goal, pace: Pace, nowYm: string): GoalPlan {
  const monthsLeft = Math.max(0, monthsBetween(nowYm, goal.targetYm))
  const monthlyPace = Math.max(0, pace.monthlySaving) + Math.max(0, pace.monthlySide)
  const projected = have + monthlyPace * monthsLeft
  const gap = goal.amount - projected
  const progress = goal.amount > 0 ? Math.min(1, Math.max(0, have / goal.amount)) : 0

  // 지금 속도로 닿는 달
  let reachYm: string | null = null
  let delayMonths: number | null = null
  if (have >= goal.amount) {
    reachYm = nowYm
    delayMonths = 0
  } else if (monthlyPace > 0) {
    const need = Math.ceil((goal.amount - have) / monthlyPace)
    reachYm = shiftYm(nowYm, need)
    delayMonths = Math.max(0, need - monthsLeft)
  }

  const extraPerMonth = gap > 0 && monthsLeft > 0 ? ceilMan(gap / monthsLeft) : gap > 0 ? null : 0

  let status: GoalStatus
  if (gap <= 0) status = 'on'
  else if (delayMonths !== null && delayMonths <= SLIGHT_LIMIT) status = 'slight'
  else status = 'off'

  // 연도별 — 지금, 12달마다, 마지막은 목표 달(12의 배수가 아니어도)
  const yearly: { ym: string; value: number }[] = []
  for (let m = 0; m < monthsLeft; m += 12) {
    yearly.push({ ym: shiftYm(nowYm, m), value: have + monthlyPace * m })
  }
  yearly.push({ ym: goal.targetYm, value: projected })

  return {
    monthsLeft,
    monthlyPace,
    projected,
    gap,
    progress,
    extraPerMonth,
    reachYm,
    delayMonths,
    status,
    yearly,
  }
}

/**
 * "만약에" — 한 사람 소득이 멈추면.
 * 저축은 '소득 − 지출'이니, 그 사람 소득만큼 저축 여력이 줄어든다고 본다.
 * 0 밑으로는 안 내려간다(빚내서 저축하진 않으니까).
 */
export function paceWithoutIncome(pace: Pace, lostIncome: number): Pace {
  const cut = Math.max(0, lostIncome)
  const saving = Math.max(0, pace.monthlySaving - cut)
  // 부수입은 그 사람 것일 수도 아닐 수도 있다 — 모르니 건드리지 않는다
  return { monthlySaving: saving, monthlySide: pace.monthlySide }
}

export const STATUS_LABEL: Record<GoalStatus, string> = {
  on: '잘 가고 있어요',
  slight: '조금 모자라요',
  off: '다시 잡아야 해요',
}
