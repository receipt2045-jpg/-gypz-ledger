import { describe, expect, it } from 'vitest'
import { computeRoadmap, flowAt, ledgerAverages, monthsBetween, project, type RoadmapInput } from './roadmap'
import type { MonthlyLedger } from '../types'

const base: RoadmapInput = {
  startYm: '2026-10',
  netWorth: 100_000_000,
  target: 300_000_000,
  targetYm: '2036-12',
  monthlySaving: 2_000_000,
  income1: 4_000_000,
  income2: 3_000_000,
  returnRate: 0,
  incomeGrowth: 0,
  realTerms: false,
  events: [],
}

describe('roadmap', () => {
  it('monthsBetween', () => {
    expect(monthsBetween('2026-10', '2027-01')).toBe(3)
    expect(monthsBetween('2027-01', '2026-10')).toBe(-3)
  })

  it('수익률 0이면 저축만큼 쌓인다', () => {
    const p = project(base)
    expect(p[0].value).toBe(100_000_000)
    expect(p[12].value).toBe(124_000_000)
  })

  it('지금 속도로 닿는 달 — 2억 모자라면 저축 200만으로 100개월', () => {
    const r = computeRoadmap(base)
    expect(r.reachYm).toBe('2035-02')
    expect(r.extraNeeded).toBe(0)
    expect(r.onTrack).toBeNull()
  })

  it('목표 연도에 못 닿으면 매달 더 모을 돈을 만 원 단위로 올림', () => {
    const r = computeRoadmap({ ...base, targetYm: '2030-10' }) // 48개월
    // 2억 / 48 = 416.7만 → 216.7만 더 → 217만
    expect(r.extraNeeded).toBe(2_170_000)
    expect(r.onTrack).not.toBeNull()
  })

  it('집: 첫 달 취득비용, 다음 달부터 이자', () => {
    const ev = { id: 'h', kind: 'house' as const, ym: '2028-01', price: 600_000_000, loan: 400_000_000 }
    expect(flowAt(ev, '2027-12', base)).toBe(0)
    expect(flowAt(ev, '2028-01', base)).toBe(18_000_000)
    expect(flowAt(ev, '2028-02', base)).toBe(1_333_333)
  })

  it('육아휴직: 그 사람 소득에서 급여를 뺀 만큼, 기간 동안만', () => {
    const ev = { id: 'l', kind: 'leave' as const, ym: '2027-03', member: 2 as const, months: 12 }
    expect(flowAt(ev, '2027-03', base)).toBe(500_000) // 300만 − 첫 달 상한 250만
    expect(flowAt(ev, '2028-03', base)).toBe(0)
  })

  it('마일스톤은 지금보다 크고 목표보다 작은 것 셋까지', () => {
    const r = computeRoadmap({ ...base, target: 3_000_000_000 })
    expect(r.milestones.map((m) => m.amount)).toEqual([200_000_000, 300_000_000, 500_000_000])
  })

  it('가계부 평균: 수입 적힌 달만, 최근 6개월', () => {
    const lg = (ym: string, income: number, expense: number): MonthlyLedger => ({
      ym,
      closed: true,
      items: [
        { id: ym + 'i', group: 'income', category: '주수입', member: 1, planned: 0, actual: income },
        { id: ym + 'e', group: 'variable', category: '식비', member: 1, planned: 0, actual: expense },
      ],
    })
    const a = ledgerAverages([lg('2026-08', 5_000_000, 2_000_000), lg('2026-09', 5_000_000, 3_000_000), lg('2026-10', 0, 0)])
    expect(a).toEqual({ saving: 2_500_000, income1: 5_000_000, income2: 0, months: 2 })
  })
})
