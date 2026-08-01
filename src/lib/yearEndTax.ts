// ── 연말정산: 맞벌이 부부 카드 사용 판단 ──────────
//
// 부부의 카드 사용액은 합산되지 않고 명의자 기준으로 각각 공제된다.
// 그래서 "누구 카드로 쓸까"가 실제로 세금을 바꾸는 결정이 된다.
//
// 두 힘이 반대로 작용한다:
//   ① 소득이 적을수록 '총급여의 25%' 문턱을 넘기 쉽다 → 공제가 시작된다
//   ② 소득이 많을수록 세율이 높다 → 같은 공제액이라도 아끼는 세금이 크다
// 그래서 답이 상황에 따라 뒤집힌다. 이 파일은 그 갈림길을 계산한다.
//
// 모든 값은 참고용 추정이다. 실제 공제는 부양가족·의료비·연금 등에 따라 달라진다.

/** 신용카드 등 사용액 소득공제가 시작되는 지점 (총급여의 25%) */
export const CARD_THRESHOLD_RATE = 0.25
/** 의료비 세액공제가 시작되는 지점 (총급여의 3%) */
export const MEDICAL_THRESHOLD_RATE = 0.03

/** 결제수단별 공제율 */
export const CARD_RATE = {
  credit: 0.15, // 신용카드
  check: 0.3, // 체크카드·현금영수증
  market: 0.4, // 전통시장·대중교통
} as const

/** 신용카드 등 소득공제 기본 한도 (공제금액 기준) */
export function cardDeductionLimit(gross: number): number {
  return gross <= 70_000_000 ? 3_000_000 : 2_500_000
}

/** 공제가 시작되는 사용액 */
export function cardThreshold(gross: number): number {
  return Math.round(gross * CARD_THRESHOLD_RATE)
}

/** 의료비 공제가 시작되는 지출액 */
export function medicalThreshold(gross: number): number {
  return Math.round(gross * MEDICAL_THRESHOLD_RATE)
}

/** 근로소득공제 (총급여 구간별) */
export function laborIncomeDeduction(gross: number): number {
  if (gross <= 5_000_000) return Math.round(gross * 0.7)
  if (gross <= 15_000_000) return Math.round(3_500_000 + (gross - 5_000_000) * 0.4)
  if (gross <= 45_000_000) return Math.round(7_500_000 + (gross - 15_000_000) * 0.15)
  if (gross <= 100_000_000) return Math.round(12_000_000 + (gross - 45_000_000) * 0.05)
  return Math.round(14_750_000 + (gross - 100_000_000) * 0.02)
}

/**
 * 과세표준 대략 추정 — 근로소득공제와 본인 기본공제(150만)만 반영한다.
 * 부양가족·연금·보험료 등은 사람마다 달라 여기서 다루지 않는다.
 * 세율 구간을 가늠하는 용도로만 쓴다.
 */
export function estimatedTaxBase(gross: number): number {
  return Math.max(0, gross - laborIncomeDeduction(gross) - 1_500_000)
}

const BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 14_000_000, rate: 0.06 },
  { upTo: 50_000_000, rate: 0.15 },
  { upTo: 88_000_000, rate: 0.24 },
  { upTo: 150_000_000, rate: 0.35 },
  { upTo: 300_000_000, rate: 0.38 },
  { upTo: 500_000_000, rate: 0.4 },
  { upTo: 1_000_000_000, rate: 0.42 },
  { upTo: Infinity, rate: 0.45 },
]

/** 과세표준에 적용되는 한계세율 (지방소득세 10% 제외) */
export function marginalRate(taxBase: number): number {
  return BRACKETS.find((b) => taxBase <= b.upTo)!.rate
}

export interface MemberInput {
  /** 총급여 (세전 연봉에서 비과세를 뺀 금액) */
  gross: number
  /** 올해 지금까지 이 사람 명의로 쓴 카드·현금영수증 합계 */
  spent: number
}

export interface MemberStatus {
  gross: number
  spent: number
  threshold: number // 공제 시작점
  remaining: number // 문턱까지 남은 금액 (넘었으면 0)
  cleared: boolean // 문턱을 넘었는지
  rate: number // 한계세율
  limit: number // 공제금액 한도
  /** 문턱 초과분을 신용카드(15%)로 봤을 때의 대략적인 공제금액 */
  estimatedDeduction: number
  limitReached: boolean // 더 써도 공제가 늘지 않는 상태
}

export function statusOf({ gross, spent }: MemberInput): MemberStatus {
  const threshold = cardThreshold(gross)
  const over = Math.max(0, spent - threshold)
  const limit = cardDeductionLimit(gross)
  const raw = Math.round(over * CARD_RATE.credit)
  const estimatedDeduction = Math.min(raw, limit)
  return {
    gross,
    spent,
    threshold,
    remaining: Math.max(0, threshold - spent),
    cleared: spent >= threshold && gross > 0,
    rate: marginalRate(estimatedTaxBase(gross)),
    limit,
    estimatedDeduction,
    limitReached: raw >= limit && limit > 0,
  }
}

export type Winner = 1 | 2 | 'either' | 'none'

export interface CardAdvice {
  winner: Winner
  /** 왜 그런지 — 화면에 그대로 쓰는 한 문장 */
  reason: string
  a: MemberStatus
  b: MemberStatus
}

/**
 * 지금 누구 카드를 쓰는 게 유리한지.
 * 판단 순서: 한도 소진 → 문턱 통과 여부 → 세율 → 남은 문턱
 */
export function recommendCard(m1: MemberInput, m2: MemberInput): CardAdvice {
  const a = statusOf(m1)
  const b = statusOf(m2)
  const pick = (winner: Winner, reason: string): CardAdvice => ({ winner, reason, a, b })

  // 1) 한도를 다 채웠으면 더 써도 공제가 안 늘어난다
  if (a.limitReached && b.limitReached) {
    return pick('none', '두 분 다 공제 한도를 채웠어요. 이제부턴 카드 혜택이 좋은 쪽으로 쓰셔도 돼요.')
  }
  if (a.limitReached) return pick(2, '한 분은 공제 한도를 이미 채웠어요. 남은 쪽으로 쓰는 게 이득이에요.')
  if (b.limitReached) return pick(1, '한 분은 공제 한도를 이미 채웠어요. 남은 쪽으로 쓰는 게 이득이에요.')

  // 2) 한 명만 문턱을 넘었으면, 넘은 사람은 쓰는 족족 공제된다
  if (a.cleared && !b.cleared) return pick(1, '이미 문턱을 넘어서, 여기서 쓰는 금액은 바로 공제로 이어져요.')
  if (b.cleared && !a.cleared) return pick(2, '이미 문턱을 넘어서, 여기서 쓰는 금액은 바로 공제로 이어져요.')

  // 3) 둘 다 넘었으면 세율이 높은 쪽이 같은 공제액으로 더 많이 아낀다
  if (a.cleared && b.cleared) {
    if (a.rate > b.rate) return pick(1, '두 분 다 문턱을 넘었어요. 이럴 땐 세율이 높은 쪽이 더 많이 돌려받아요.')
    if (b.rate > a.rate) return pick(2, '두 분 다 문턱을 넘었어요. 이럴 땐 세율이 높은 쪽이 더 많이 돌려받아요.')
    return pick('either', '두 분 다 문턱을 넘었고 세율도 같아요. 어느 쪽으로 쓰셔도 비슷해요.')
  }

  // 4) 둘 다 못 넘었으면 문턱이 가까운 쪽부터 넘기는 게 빠르다
  if (a.remaining < b.remaining) return pick(1, '문턱까지 남은 금액이 더 적어요. 먼저 넘겨두면 그 뒤부터 공제가 시작돼요.')
  if (b.remaining < a.remaining) return pick(2, '문턱까지 남은 금액이 더 적어요. 먼저 넘겨두면 그 뒤부터 공제가 시작돼요.')
  return pick('either', '두 분의 조건이 같아요. 어느 쪽으로 쓰셔도 비슷해요.')
}

/** 항목별 기본 원칙 — 계산이 아니라 알고 있으면 득이 되는 규칙 */
export const RULES = [
  {
    title: '의료비는 소득이 적은 쪽으로',
    body: '의료비는 총급여의 3%를 넘어야 공제가 시작돼요. 소득이 적을수록 그 문턱이 낮아서 유리해요.',
  },
  {
    title: '부양가족은 소득이 많은 쪽으로',
    body: '인적공제는 세율이 높은 쪽에 붙일 때 아끼는 세금이 커져요.',
  },
  {
    title: '부부 카드는 합쳐지지 않아요',
    body: '카드 사용액은 명의자 기준으로 각각 계산돼요. 그래서 누구 카드로 쓰는지가 중요해요.',
  },
  {
    title: '문턱을 넘은 뒤엔 체크카드가 유리',
    body: '신용카드는 15%, 체크카드·현금영수증은 30%가 공제돼요. 문턱까지는 혜택 좋은 신용카드, 그 뒤는 체크카드가 정석이에요.',
  },
] as const
