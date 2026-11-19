import { describe, expect, it } from 'vitest'
import { computeMatch, matchLabel } from './valuesMatch'

const G = [
  { title: '소비', emoji: '🛍️', items: ['a', 'b'] },
  { title: '투자', emoji: '📈', items: ['c', 'd'] },
]

describe('computeMatch (1~5점)', () => {
  it('차이만큼 점수를 깎고, 한 칸 차이는 비슷으로 센다', () => {
    // 소비: 5vs5(1) · 1vs5(0) → 0.5 / 투자: 4vs5(0.75) · 비어 있음
    const m = computeMatch(G, [5, 1, 4, 0], [5, 5, 5, 3])
    expect(m.both).toBe(3)
    expect(m.same).toBe(2)
    expect(m.percent).toBe(58) // (1 + 0 + 0.75) / 3
    expect(m.best?.title).toBe('투자')
    expect(m.worst?.title).toBe('소비')
  })
  it('겹치는 답이 없으면 0%', () => {
    const m = computeMatch(G, [1, 0, 0, 0], [0, 1, 0, 0])
    expect(m.both).toBe(0)
    expect(m.percent).toBe(0)
    expect(m.best).toBeNull()
  })
  it('다 똑같으면 100%', () => {
    expect(computeMatch(G, [3, 4, 5, 1], [3, 4, 5, 1]).percent).toBe(100)
  })
})

describe('matchLabel', () => {
  it('구간마다 이름', () => {
    expect(matchLabel(95).label).toBe('찰떡 부부')
    expect(matchLabel(80).label).toBe('잘 맞는 부부')
    expect(matchLabel(60).label).toBe('맞춰 가는 부부')
    expect(matchLabel(10).label).toBe('이야기가 필요한 부부')
  })
})
