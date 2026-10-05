/**
 * 자산 로드맵 — 지금 순자산에서 목표 순자산까지 언제 닿는지 달마다 굴려 본다.
 *
 * 한 달 = 지난달 순자산 × (1 + 수익률/12) + 저축 − 그달 큰일에 나가는 돈.
 * 집을 사도 현금이 집으로 바뀔 뿐이라 순자산은 그대로다. 대신 취득세·중개비와
 * 대출 이자가 빠진다(원금 상환은 빚이 줄어드는 거라 순자산을 깎지 않는다).
 * 방향을 잡는 계산이고, 기본값은 화면에서 모두 고칠 수 있다.
 */
import type { Profile, Roadmap, RoadmapEvent, RoadmapEventKind } from '../types'
import { abbreviateKRW, shiftYm } from './format'
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
  milestones: { amount: number; ym: string | null }[]
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

  const milestones = MILESTONES.filter((m) => m > input.netWorth && m < input.target)
    .slice(0, 3)
    .map((amount) => ({ amount, ym: reachOf(points, amount) }))

  return { points, onTrack, reachYm, extraNeeded, milestones }
}

/** 계획 목록 한 줄 설명 */
export function eventSummary(ev: RoadmapEvent, names: [string, string]): string {
  const man = (n = 0) => abbreviateKRW(n).replace(/원$/, '')
  const when = ev.ym.replace('-', '.')
  switch (ev.kind) {
    case 'house':
      return `${when} · ${man(ev.price)} · 대출 ${man(ev.loan)}`
    case 'child':
      return `${when} 출생 · 양육비 월 ${man(ev.monthly ?? RULES.childCostDefault)}`
    case 'leave':
      return `${when}부터 ${ev.months ?? 12}개월 · ${names[(ev.member ?? 2) - 1]}`
    case 'car':
      return `${when} · ${man(ev.once)}`
    case 'job': {
      const m = -(ev.monthly ?? 0)
      return `${when}부터 · 월 ${m >= 0 ? '+' : '-'}${man(Math.abs(m))}`
    }
    case 'parents':
    case 'custom': {
      const parts = [when]
      if (ev.once) parts.push(man(ev.once))
      if (ev.monthly) parts.push(`월 ${man(ev.monthly)}${ev.months ? ` · ${ev.months}개월` : ''}`)
      return parts.join(' · ')
    }
  }
}
