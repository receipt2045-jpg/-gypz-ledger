import type { BudgetItem } from '../types'

/**
 * 고정비 점검 — "우리집 고정비, 이만하면 괜찮은 걸까?"
 *
 * 금액만으로는 답이 안 나온다. 보험료 20만원은 월 700만 버는 집에선 2.9%,
 * 300만 버는 집에선 6.7%다. 그래서 전부 '수입 대비 비율'로 본다.
 *
 * 순위(상위 몇 %)로 보여주지 않는 이유:
 * 하위권이라는 말은 위축만 시키고 행동으로 이어지지 않는다. 대신 '얼마나
 * 줄일 수 있는지'와 '그 돈을 10년 모으면 얼마인지'로 바꿔서 보여준다.
 * 모아불리가 보는 시간 단위(10년)와 같은 자리에서 이야기하기 위함이다.
 */

export interface Band {
  /** 권장 상한 (수입 대비 비율) */
  max: number
  /** 이 기준이 어디서 왔는지 — 화면에 그대로 보여준다 */
  source: string
}

/**
 * 기준선은 '정답'이 아니라 '통용되는 눈금'이다. 근거를 같이 들고 다녀야
 * 사용자가 스스로 판단할 수 있으므로 source를 함께 둔다.
 */
export const FIXED_BANDS: Record<string, Band> = {
  주거: { max: 0.3, source: '소득의 30% 이내 (주거비 30% 법칙)' },
  보험: { max: 0.1, source: '소득의 5~10% (생명보험협회 등 통용 기준)' },
  통신: { max: 0.05, source: '소득의 5% 이내 (가계동향조사 평균 수준)' },
  용돈: { max: 0.1, source: '소득의 10% 이내' },
  구독: { max: 0.02, source: '소득의 2% 이내' },
}

/** 고정지출 전체 합계 기준 — 이걸 넘으면 개별 항목보다 총량이 문제다 */
export const TOTAL_FIXED_MAX = 0.5

export type Status = 'ok' | 'over' | 'unknown'

export interface CategoryVerdict {
  category: string
  amount: number
  ratio: number // 수입 대비
  status: Status
  /** 권장 상한을 넘은 금액(월). ok·unknown이면 0 */
  overBy: number
  /** overBy를 10년 모았을 때 (원금만) */
  tenYear: number
  band?: Band
}

export interface FixedCostReport {
  income: number
  totalFixed: number
  totalRatio: number
  totalStatus: Status
  categories: CategoryVerdict[]
  /** 줄일 여지가 있는 항목들의 월 합계 */
  totalOverBy: number
  tenYearTotal: number
}

/** 10년치(원금만). 이자를 얹으면 계산 근거를 설명하기 어려워져 단순 합으로 둔다. */
function tenYearOf(monthly: number): number {
  return Math.round(monthly * 12 * 10)
}

/** 결산 완료면 실제값, 아니면 계획값 */
function amountOf(it: BudgetItem, closed: boolean): number {
  return closed ? it.actual : it.planned
}

/**
 * 그 달의 고정지출을 항목별로 진단한다.
 * 수입이 없으면(아직 입력 전) 비교 자체가 불가능하므로 빈 결과를 준다.
 */
export function buildFixedCostReport(items: BudgetItem[], closed: boolean): FixedCostReport {
  const income = items
    .filter((it) => it.group === 'income')
    .reduce((a, it) => a + amountOf(it, closed), 0)

  // 같은 카테고리를 부부가 따로 쓰는 경우가 있어 이름으로 합친다
  const byCategory = new Map<string, number>()
  for (const it of items) {
    if (it.group !== 'fixed') continue
    byCategory.set(it.category, (byCategory.get(it.category) ?? 0) + amountOf(it, closed))
  }

  const totalFixed = [...byCategory.values()].reduce((a, b) => a + b, 0)

  const categories: CategoryVerdict[] = [...byCategory.entries()]
    .map(([category, amount]) => {
      const band = FIXED_BANDS[category]
      const ratio = income > 0 ? amount / income : 0
      if (!band || income <= 0) {
        return { category, amount, ratio, status: 'unknown' as Status, overBy: 0, tenYear: 0 }
      }
      const limit = income * band.max
      const overBy = Math.max(0, Math.round(amount - limit))
      return {
        category,
        amount,
        ratio,
        status: overBy > 0 ? ('over' as Status) : ('ok' as Status),
        overBy,
        tenYear: tenYearOf(overBy),
        band,
      }
    })
    // 줄일 여지가 큰 것부터
    .sort((a, b) => b.overBy - a.overBy || b.amount - a.amount)

  const totalOverBy = categories.reduce((a, c) => a + c.overBy, 0)
  const totalRatio = income > 0 ? totalFixed / income : 0

  return {
    income,
    totalFixed,
    totalRatio,
    totalStatus:
      income <= 0 ? 'unknown' : totalRatio > TOTAL_FIXED_MAX ? 'over' : 'ok',
    categories,
    totalOverBy,
    tenYearTotal: tenYearOf(totalOverBy),
  }
}

/** 카드 맨 위에 쓸 한 줄 */
export function headlineOf(r: FixedCostReport): string {
  if (r.totalStatus === 'unknown') return '수입을 넣으면 우리집 고정비를 견줘 볼 수 있어요'
  const pct = Math.round(r.totalRatio * 100)
  if (r.totalStatus === 'over') {
    return `고정비가 수입의 ${pct}%예요. 절반을 넘으면 모으기 어려워집니다.`
  }
  if (r.totalOverBy > 0) {
    return `고정비는 수입의 ${pct}%로 무난해요. 다만 줄일 여지가 남아 있어요.`
  }
  return `고정비가 수입의 ${pct}%예요. 잘 잡혀 있습니다.`
}
