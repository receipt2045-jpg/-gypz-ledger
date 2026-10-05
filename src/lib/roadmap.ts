/**
 * 자산 로드맵 — 지금 순자산에서 목표 순자산까지 언제 닿는지 달마다 굴려 본다.
 *
 * 한 달 = 지난달 순자산 × (1 + 수익률/12) + 저축 − 그달 큰일에 나가는 돈.
 * 집을 사도 현금이 집으로 바뀔 뿐이라 순자산은 그대로다. 대신 취득세·중개비와
 * 대출 이자가 빠진다(원금 상환은 빚이 줄어드는 거라 순자산을 깎지 않는다).
 * 방향을 잡는 계산이고, 기본값은 화면에서 모두 고칠 수 있다.
 */
import type { Profile, Roadmap, RoadmapEvent, RoadmapEventKind } from '../types'
import { shiftYm } from './format'
import { RULES, govAt, leavePayAt } from './parentalLeave'

export const RETURN_PRESETS = [
  { label: '보수', rate: 0.03 },
  { label: '보통', rate: 0.05 },
  { label: '적극', rate: 0.07 },
] as const
export const GROWTH_PRESETS = [0, 0.02, 0.03, 0.05] as const

export const DEFAULT_RETURN = 0.05
export const DEFAULT_GROWTH = 0.03
export const INFLATION = 0.025 // 물가 상승률 (지금 돈 가치로 볼 때)
export const HOUSE_COST_RATE = 0.03 // 취득세·중개비 대략
export const LOAN_RATE = 0.04 // 주담대 금리 대략
export const LOAN_MONTHS = 360 // 30년 원금 균등 상환으로 본다
export const CHILD_YEARS = 19 // 양육비는 만 19세 되기 전까지
export const MAX_MONTHS = 40 * 12

export const EVENT_META: Record<RoadmapEventKind, { emoji: string; label: string }> = {
  house: { emoji: '🏠', label: '내 집 마련' },
  child: { emoji: '👶', label: '자녀' },
  leave: { emoji: '🍼', label: '육아휴직' },
  car: { emoji: '🚗', label: '차' },
  job: { emoji: '💼', label: '이직·창업' },
  parents: { emoji: '👪', label: '부모님' },
  custom: { emoji: '✏️', label: '직접 입력' },
}

const MILESTONES = [1, 2, 3, 5, 10, 20, 30, 50, 100].map((n) => n * 100_000_000)

/** a에서 b까지 몇 달 (b가 뒤면 양수) */
export function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

export interface RoadmapInput {
  startYm: string
  netWorth: number
  target: number
  targetYm: string
  monthlySaving: number
  income1: number
  income2: number
  returnRate: number
  incomeGrowth: number
  realTerms: boolean
  events: RoadmapEvent[]
}

/**
 * 프로필로 계산 입력을 채운다. 가계부 기록은 가져오지 않는다(2026-10-06) —
 * 로드맵은 앞으로의 계획이라 사용자가 직접 적은 값만 쓴다. 지금 재산만 자산 탭에서 온다.
 */
export function roadmapInput(profile: Profile, netWorth: number, startYm: string): RoadmapInput {
  const r: Roadmap = profile.roadmap ?? { events: [] }
  const targetYear = r.targetYear ?? profile.startYear + 10
  return {
    startYm,
    netWorth,
    target: profile.targetNetWorth,
    targetYm: `${targetYear}-12`,
    monthlySaving: r.monthlySaving ?? 0,
    income1: r.income1 ?? 0,
    income2: r.income2 ?? 0,
    returnRate: r.returnRate ?? DEFAULT_RETURN,
    incomeGrowth: r.incomeGrowth ?? DEFAULT_GROWTH,
    realTerms: r.realTerms ?? false,
    events: r.events ?? [],
  }
}

/** 이 큰일 때문에 ym 달에 덜 모이는 돈 (원, 더 모이면 음수) */
export function flowAt(ev: RoadmapEvent, ym: string, input: Pick<RoadmapInput, 'income1' | 'income2'>): number {
  const k = monthsBetween(ev.ym, ym) // 0 = 시작 달
  if (k < 0) return 0
  const inRange = ev.months === undefined || k < ev.months
  switch (ev.kind) {
    case 'house': {
      const price = ev.price ?? 0
      const loan = ev.loan ?? 0
      if (k === 0) return Math.round(price * HOUSE_COST_RATE)
      if (k > LOAN_MONTHS) return 0
      const left = loan * (1 - (k - 1) / LOAN_MONTHS)
      return Math.round((left * LOAN_RATE) / 12)
    }
    case 'child': {
      const t = k
      if (t >= CHILD_YEARS * 12) return 0
      const cost = ev.monthly ?? RULES.childCostDefault
      return cost - govAt(t, 13)
    }
    case 'leave': {
      if (!inRange) return 0
      const pay = ev.member === 1 ? input.income1 : input.income2
      return Math.max(0, pay - leavePayAt(k + 1, pay, false))
    }
    case 'car':
      return k === 0 ? (ev.once ?? 0) : 0
    case 'job':
    case 'parents':
    case 'custom':
      return (k === 0 ? (ev.once ?? 0) : 0) + (inRange ? (ev.monthly ?? 0) : 0)
  }
}

export interface RoadmapPoint {
  ym: string
  value: number
}

/** 달마다 굴린 순자산 (startYm부터 MAX_MONTHS개월). realTerms면 지금 돈 가치로 바꿔 둔다 */
export function project(input: RoadmapInput, extra = 0): RoadmapPoint[] {
  const out: RoadmapPoint[] = [{ ym: input.startYm, value: input.netWorth }]
  let nw = input.netWorth
  for (let t = 1; t <= MAX_MONTHS; t++) {
    const ym = shiftYm(input.startYm, t)
    const saving = input.monthlySaving * Math.pow(1 + input.incomeGrowth, (t - 1) / 12)
    const spend = input.events.reduce((acc, ev) => acc + flowAt(ev, ym, input), 0)
    nw = nw * (1 + input.returnRate / 12) + saving + extra - spend
    const value = input.realTerms ? nw / Math.pow(1 + INFLATION, t / 12) : nw
    out.push({ ym, value: Math.round(value) })
  }
  return out
}

const reachOf = (points: RoadmapPoint[], target: number) =>
  points.find((p) => p.value >= target)?.ym ?? null

const valueAt = (points: RoadmapPoint[], ym: string) =>
  points.find((p) => p.ym === ym)?.value ?? points[points.length - 1].value

export interface RoadmapResult {
  points: RoadmapPoint[] // 지금 속도
  onTrack: RoadmapPoint[] | null // 목표 연도에 맞춘 속도 (이미 맞으면 null)
  reachYm: string | null // 지금 속도로 목표에 닿는 달 (40년 안에 못 닿으면 null)
  extraNeeded: number // 목표 연도에 맞추려면 매달 더 모아야 하는 돈 (만 원 단위 올림)
  milestones: { amount: number; ym: string | null }[] // 지금과 목표 사이 1·2·3·5·10·20·30·50억
}

export function computeRoadmap(input: RoadmapInput): RoadmapResult {
  const points = project(input)
  const reachYm = input.target > 0 ? reachOf(points, input.target) : null

  let extraNeeded = 0
  let onTrack: RoadmapPoint[] | null = null
  const due = monthsBetween(input.startYm, input.targetYm)
  if (input.target > 0 && due > 0 && valueAt(points, input.targetYm) < input.target) {
    // 매달 target만큼 더 모으면 반드시 닿는다 — 그 사이를 반씩 좁힌다
    let lo = 0
    let hi = input.target
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (valueAt(project(input, mid), input.targetYm) >= input.target) hi = mid
      else lo = mid
    }
    extraNeeded = Math.ceil(hi / 10_000) * 10_000
    onTrack = project(input, extraNeeded)
  }

  const milestones = MILESTONES.filter((m) => m > input.netWorth && m < input.target).map((amount) => ({ amount, ym: reachOf(points, amount) }))

  return { points, onTrack, reachYm, extraNeeded, milestones }
}

/** "3억 2천", "8,500만" — 타임라인용 짧은 금액 */
export function compactKRW(n: number): string {
  const v = Math.max(0, Math.round(n))
  if (v < 100_000_000) return `${Math.round(v / 10_000).toLocaleString('ko-KR')}만`
  let eok = Math.floor(v / 100_000_000)
  let chun = Math.round((v % 100_000_000) / 10_000_000)
  if (chun === 10) {
    eok += 1
    chun = 0
  }
  return chun ? `${eok.toLocaleString('ko-KR')}억 ${chun}천` : `${eok.toLocaleString('ko-KR')}억`
}

export type TimelineRow =
  | {
      kind: 'year'
      year: number
      value: number // 그해 말 예상 재산 (올해는 지금 재산)
      isNow: boolean
      isTarget: boolean // 목표한 해
      reached: boolean // 이 해에 목표 도착
      events: RoadmapEvent[]
      milestones: number[] // 이 해에 넘는 마일스톤
    }
  | { kind: 'quiet'; from: number; to: number; perYear: number } // 아무 일 없는 해 묶음

/**
 * 연도별 길. 계획·마일스톤·목표가 있는 해만 한 줄씩, 그 사이 조용한 해는 한 줄로 묶는다.
 * 목표한 해와 목표에 닿는 해 중 늦은 쪽까지 (최대 30년).
 */
export function buildTimeline(input: RoadmapInput, result: RoadmapResult, maxYears = 30): TimelineRow[] {
  const startYear = Number(input.startYm.slice(0, 4))
  const targetYear = Number(input.targetYm.slice(0, 4))
  const reachYear = result.reachYm ? Number(result.reachYm.slice(0, 4)) : null
  const endYear = Math.min(startYear + maxYears, Math.max(targetYear, reachYear ?? targetYear))
  const valueOf = (y: number) => {
    if (y <= startYear) return input.netWorth
    const i = Math.min(monthsBetween(input.startYm, `${y}-12`), result.points.length - 1)
    return result.points[i].value
  }
  const yearOf = (ym: string) => Math.max(startYear, Number(ym.slice(0, 4)))

  const rows: TimelineRow[] = []
  let quietFrom: number | null = null
  const flushQuiet = (to: number) => {
    if (quietFrom === null) return
    const n = to - quietFrom + 1
    rows.push({ kind: 'quiet', from: quietFrom, to, perYear: (valueOf(to) - valueOf(quietFrom - 1)) / n })
    quietFrom = null
  }
  for (let y = startYear; y <= endYear; y++) {
    const events = input.events.filter((e) => yearOf(e.ym) === y)
    const milestones = result.milestones.filter((m) => m.ym && yearOf(m.ym) === y).map((m) => m.amount)
    const reached = reachYear === y && input.netWorth < input.target
    const notable =
      y === startYear || y === endYear || y === targetYear || reached || events.length > 0 || milestones.length > 0
    if (!notable) {
      if (quietFrom === null) quietFrom = y
      continue
    }
    flushQuiet(y - 1)
    rows.push({
      kind: 'year',
      year: y,
      value: valueOf(y),
      isNow: y === startYear,
      isTarget: y === targetYear,
      reached,
      events,
      milestones,
    })
  }
  return rows
}
