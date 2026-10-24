import { describe, expect, it } from 'vitest'
import { SHARES, isNewShare, otherShares, sharesByDate } from './shares'

describe('결영이네 자료 나눔 (2026-10-24)', () => {
  it('최신순, 주소는 겹치지 않는다', () => {
    const dates = sharesByDate().map((s) => s.date)
    expect([...dates].sort().reverse()).toEqual(dates)
    expect(new Set(SHARES.map((s) => s.path)).size).toBe(SHARES.length)
  })

  it('다른 자료: 지금 보는 건 빼고, 같은 분류가 먼저', () => {
    const others = otherShares('/calc/home-cost')
    expect(others.map((s) => s.path)).not.toContain('/calc/home-cost')
    expect(others[0].category).toBe('내집마련')
  })

  it('링크로 들어와 주소 끝에 /가 붙어도(#/gold/) 지금 보는 자료는 뺀다', () => {
    expect(otherShares('/gold/').map((s) => s.path)).not.toContain('/gold')
  })

  it('목록에 없는 페이지(다른 계산기)에선 최신순 그대로', () => {
    expect(otherShares('/calc/retire', 2)).toEqual(sharesByDate().slice(0, 2))
  })

  it('올린 지 2주 안이면 NEW', () => {
    const gold = SHARES.find((s) => s.slug === 'gold')!
    expect(isNewShare(gold, new Date('2026-10-30'))).toBe(true)
    expect(isNewShare(gold, new Date('2026-11-10'))).toBe(false)
  })
})
