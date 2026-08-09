import { describe, expect, it } from 'vitest'
import { peerIsHigh, peerLabel, peerStateOf, type PeerRow } from './peerBenchmark'

const row = (over: Partial<PeerRow>): PeerRow => ({
  category: '보험',
  n: 30,
  my_amount: 700_000,
  median_amount: 380_000,
  rank_pct: null,
  band: 'high',
  ...over,
})

describe('peerStateOf — 표본에 따라 말할 수 있는 것이 달라진다', () => {
  it('20집 미만이면 잠그고, 몇 집 더 필요한지 알려준다', () => {
    const s = peerStateOf(row({ n: 14, median_amount: null, band: null }))
    expect(s).toEqual({ kind: 'locked', need: 6 })
    expect(peerLabel(s)).toBe('6집 더 모이면 비교할 수 있어요')
  })

  // 20집으로 "상위 12%"라고 하면 없는 정밀도를 꾸며내는 것이다
  it('20~49집이면 3단계까지만 말한다', () => {
    const s = peerStateOf(row({ n: 30, rank_pct: 12, band: 'high' }))
    expect(s.kind).toBe('band')
    expect(peerLabel(s)).toBe('30집 중 많이 쓰는 편')
    expect(peerLabel(s)).not.toContain('%')
  })

  it('50집 이상이면 정확한 백분위를 말한다', () => {
    const s = peerStateOf(row({ n: 128, rank_pct: 12 }))
    expect(s).toMatchObject({ kind: 'exact', rankPct: 12, n: 128 })
    expect(peerLabel(s)).toBe('128집 중 상위 12%')
  })

  it('50집이어도 서버가 순위를 안 주면 3단계로 물러난다', () => {
    expect(peerStateOf(row({ n: 60, rank_pct: null })).kind).toBe('band')
  })

  it('중간값이 없으면(서버가 가린 상태) 잠금으로 본다', () => {
    expect(peerStateOf(row({ n: 40, median_amount: null })).kind).toBe('locked')
  })
})

describe('peerLabel — 적게 쓰는 집도 알려준다', () => {
  it('적게 쓰는 편', () => {
    expect(peerLabel(peerStateOf(row({ band: 'low' })))).toBe('30집 중 적게 쓰는 편')
  })
  it('보통', () => {
    expect(peerLabel(peerStateOf(row({ band: 'mid' })))).toBe('30집 중 보통')
  })
})

describe('peerIsHigh — 강조는 많이 쓸 때만', () => {
  it('많이 쓰는 편이면 강조', () => {
    expect(peerIsHigh(peerStateOf(row({ band: 'high' })))).toBe(true)
  })
  it('상위 25% 안이면 강조', () => {
    expect(peerIsHigh(peerStateOf(row({ n: 100, rank_pct: 20 })))).toBe(true)
    expect(peerIsHigh(peerStateOf(row({ n: 100, rank_pct: 60 })))).toBe(false)
  })
  it('적게 쓰거나 잠금이면 강조하지 않는다', () => {
    expect(peerIsHigh(peerStateOf(row({ band: 'low' })))).toBe(false)
    expect(peerIsHigh(peerStateOf(row({ n: 5, median_amount: null })))).toBe(false)
  })
})
