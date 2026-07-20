// ============================================================
// 내집마련 로드맵 엔진
// 목적지 = 내집마련(목표 순자산). 그 아래 방어/공격 4단계가 '연료'.
// 원팀 프로젝트 프레임: 절약·절세(방어) + 부수입·투자(공격)
// 앱의 3분법 고백 엔진과 같은 언어를 쓴다.
// ============================================================
import type { MonthlyLedger } from '../types'
import { effectiveAmount, type LedgerSummary } from './carryover'

// ── 방어/공격 4기둥 (각 0~4점) ────────────────
export interface Pillars {
  reduce: number // 🛡 절약 (방어) — 변동지출 통제
  protect: number // 🛡 절세 (방어) — 연금·청약 등 비과세/공제
  side: number // ⚔ 부수입 (공격) — 주수입 외 수입
  invest: number // ⚔ 투자 (공격) — 투자 비중
}

/** 비율을 4단계 점수로 (임계값 이상이면 그 점수, 0이면 0) */
function step(ratio: number, t4: number, t3: number, t2: number): number {
  if (ratio >= t4) return 4
  if (ratio >= t3) return 3
  if (ratio >= t2) return 2
  if (ratio > 0) return 1
  return 0
}

export function computePillars(ledger: MonthlyLedger, s: LedgerSummary): Pillars {
  const income = s.income
  if (income <= 0) return { reduce: 0, protect: 0, side: 0, invest: 0 }

  const sumIf = (pred: (cat: string, group: string) => boolean) =>
    ledger.items
      .filter((it) => pred(it.category, it.group))
      .reduce((a, it) => a + effectiveAmount(it, ledger.closed), 0)

  // 절약: 변동지출 부담이 낮을수록 잘 방어 중 (수입 대비 변동비 비율)
  const varRatio = s.variable / income
  const reduce = varRatio <= 0.2 ? 4 : varRatio <= 0.3 ? 3 : varRatio <= 0.4 ? 2 : varRatio <= 0.55 ? 1 : 0

  // 절세: 연금·청약·IRP 등 비과세/소득공제 저축 비중
  const taxAdv = sumIf((cat, group) => group === 'saving' && /연금|청약|IRP|저축보험/.test(cat))
  const protect = step(taxAdv / income, 0.15, 0.1, 0.05)

  // 부수입: 주수입 외 수입 비중
  const side = sumIf((cat, group) => group === 'income' && cat.includes('부수입'))
  const sideScore = step(side / income, 0.3, 0.2, 0.1)

  // 투자: 수입 대비 투자 납입 비중
  const invest = step(s.investment / income, 0.2, 0.15, 0.1)

  return { reduce, protect, side: sideScore, invest }
}

// ── 방어/공격 진단 → 전환 라우팅 ──────────────
export interface Diagnosis {
  defense: number // 절약+절세 (0~8)
  offense: number // 부수입+투자 (0~8)
  weakest: keyof Pillars
  weakestLabel: string
  /** 공격이 방어보다 뚜렷하게 비어 있으면 원팀(시스템 개조)로 */
  offenseGap: boolean
  headline: string // 결영이네 관점 한 줄
}

const PILLAR_LABEL: Record<keyof Pillars, string> = {
  reduce: '절약',
  protect: '절세',
  side: '부수입',
  invest: '투자',
}

// 초보자 눈높이 설명 (탭하면 펼쳐짐) + 이번 주 해볼 것
export interface PillarInfo {
  icon: string
  label: string
  team: '방어' | '공격'
  what: string // 이게 뭐예요
  why: string // 왜 중요해요
  action: string // 이번 주 해볼 것
}

export const PILLAR_INFO: Record<keyof Pillars, PillarInfo> = {
  reduce: {
    icon: '🛡',
    label: '절약',
    team: '방어',
    what: '변동지출(배달·카페·쇼핑)을 얼마나 잡고 있는지 봐요.',
    why: '수입을 늘리기보다 새는 돈을 막는 게 빠릅니다.',
    action: '이번 주, 배달·카페 딱 한 번만 참아보기 🍚',
  },
  protect: {
    icon: '🛡',
    label: '절세',
    team: '방어',
    what: '연금·청약처럼 세금을 돌려받거나 아끼는 저축이에요.',
    why: '연말정산에서 수십만 원이 왔다 갔다 합니다. 안 챙기면 손해예요.',
    action: '청약통장에 매달 자동이체 소액이라도 걸어두기 🏦',
  },
  side: {
    icon: '⚔️',
    label: '부수입',
    team: '공격',
    what: '월급 외에 들어오는 돈이에요. 중고 판매부터 콘텐츠까지 뭐든요.',
    why: '아무리 아껴도 한계가 있어요. 수입이 늘면 속도가 달라집니다.',
    action: '이번 주, 안 쓰는 물건 1개 중고로 올려보기 📦',
  },
  invest: {
    icon: '⚔️',
    label: '투자',
    team: '공격',
    what: '적금을 넘어 돈을 굴리는 부분이에요.',
    why: '일찍 시작할수록 복리가 크게 붙습니다.',
    action: '소액 적립식 투자 1개, 겁먹지 말고 알아만 보기 📈',
  },
}

export function diagnose(p: Pillars): Diagnosis {
  const defense = p.reduce + p.protect
  const offense = p.side + p.invest
  const entries = Object.entries(p) as [keyof Pillars, number][]
  const weakest = entries.reduce((min, e) => (e[1] < min[1] ? e : min))[0]
  const offenseGap = offense <= 2 && defense >= offense + 2

  let headline: string
  if (defense + offense === 0) headline = '아직 시작 전이에요. 예산부터 세워봐요.'
  else if (offenseGap) headline = '방어는 잘하고 있어요. 이제 공격(부수입·투자)을 채울 차례입니다.'
  else if (offense >= 6 && defense >= 6) headline = '방어도 공격도 균형이 좋아요. 이제 타이밍만 남았습니다.'
  else headline = '꾸준히 모으는 중이에요. 매일 기록이 곧 종잣돈이 됩니다.'

  return {
    defense,
    offense,
    weakest,
    weakestLabel: PILLAR_LABEL[weakest],
    offenseGap,
    headline,
  }
}

// ── 도착 시점 추정 (현재 저축 속도로) ──────────
/** 목표 순자산까지 남은 개월 수. 저축 속도가 0이거나 목표 없으면 null */
export function projectMonths(netWorth: number, target: number, monthlyPace: number): number | null {
  if (target <= 0 || monthlyPace <= 0) return null
  if (netWorth >= target) return 0
  return Math.ceil((target - netWorth) / monthlyPace)
}

export function formatDday(months: number): string {
  if (months <= 0) return '목표 달성 🎉'
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y >= 100) return 'D-100년+'
  if (y === 0 && m === 0) return 'D-1개월 미만'
  if (y > 0 && m > 0) return `D-${y}년 ${m}개월`
  if (y > 0) return `D-${y}년`
  return `D-${m}개월`
}

// ── 여정 단계 ──────────────────────────────────
export interface Stage {
  key: string
  icon: string
  title: string
  view: string // 무료로 주는 관점(원칙)
  open: string | null // 상담에서 여는 것 (null = 다 보여줘도 됨)
}

export const STAGES: Stage[] = [
  { key: 'goal', icon: '🎯', title: '목표 세우기', view: '어떤 집에서 살지부터 그려봐요. 금액은 그다음에 정해도 됩니다 🤍', open: '현실적인 목표 금액·시점은 함께 잡아야 정확해요.' },
  { key: 'coord', icon: '📍', title: '우리 현재 좌표', view: '지금 우리 순자산과 저축률부터 확인해요. 여긴 숨김없이 다 보여드립니다.', open: null },
  { key: 'seed', icon: '🔥', title: '종잣돈 엔진', view: '절약·절세로 지키고, 부수입·투자로 키워요. 여기가 제일 공들일 구간입니다.', open: null },
  { key: 'fund', icon: '🏦', title: '자금 구조', view: '대출은 얼마까지 안전할까요? LTV·DSR부터 같이 계산해요.', open: '우리는 얼마까지 대출받아도 되는지 함께 봐요.' },
  { key: 'fork', icon: '🔀', title: '청약 vs 매매', view: '청약이냐 매매냐, 우리 상황부터 봐야 답이 나옵니다.', open: '우리에겐 뭐가 맞는지 함께 정해요.' },
  { key: 'act', icon: '🏠', title: '실행', view: '마지막은 발품이에요. 임장 다니고, 타이밍 잡습니다.', open: '실제 매물·계약은 코칭이 필요해요.' },
]

/** 데이터로 현재 단계 추정 */
export function currentStageIndex(income: number, monthlyPace: number, netWorth: number, target: number): number {
  if (income <= 0) return 0 // 목표 세우기 전
  if (monthlyPace <= 0) return 1 // 좌표는 있지만 저축 시작 전
  if (target > 0 && netWorth / target >= 0.6) return 3 // 종잣돈 상당히 모임 → 자금 구조
  return 2 // 종잣돈 엔진 가동 중
}
