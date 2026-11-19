import { describe, expect, it } from 'vitest'
import { computeMatch, matchLabel } from './valuesMatch'

const G = [
  { title: '소비', emoji: '🛍️', items: ['a', 'b'] },
  { title: '투자', emoji: '📈', items: ['c', 'd'] },
]

describe('computeMatch', () => {
  it('둘 다 답한 줄만 센다', () => {
    const m = computeMatch(G, [1, 1, 2, 0], [1, 2, 2, 1])
    expect(m.both).toBe(3)
    expect(m.same).toBe(2)
    expect(m.percent).toBe(67)
    expect(m.best?.title).toBe('투자')
    expect(m.worst?.title).toBe('소비')
  })
  it('답이 하나도 겹치지 않으면 0%', () => {
    const m = computeMatch(G, [1, 0, 0, 0], [0, 1, 0, 0])
    expect(m.both).toBe(0)
    expect(m.percent).toBe(0)
    expect(m.best).toBeNull()
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
