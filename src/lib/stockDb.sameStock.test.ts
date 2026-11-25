import { describe, expect, it } from 'vitest'
import { sameStock } from './stockDb'

// 같은 종목이라도 주인이 다르면 일지가 따로다 — "남편이 넣은 삼성전자가 있으면 아내가 못 넣어요" 제보
describe('sameStock', () => {
  const husband = { name: '삼성전자', market: 'KR' as const, owner: 1 as const }
  it('이름·시장·주인이 같으면 같은 종목 (띄어쓰기 무시)', () => {
    expect(sameStock(husband, { name: '삼성 전자', market: 'KR', owner: 1 })).toBe(true)
  })
  it('주인이 다르면 다른 종목', () => {
    expect(sameStock(husband, { name: '삼성전자', market: 'KR', owner: 2 })).toBe(false)
    expect(sameStock(husband, { name: '삼성전자', market: 'KR', owner: 'shared' })).toBe(false)
  })
  it('시장이 다르면 다른 종목', () => {
    expect(sameStock(husband, { name: '삼성전자', market: 'US', owner: 1 })).toBe(false)
  })
})
