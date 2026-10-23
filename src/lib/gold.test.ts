import { describe, expect, it } from 'vitest'
import { BROKERS, DEFAULT_GOLD, brokerCost, computeGold, shopCost } from './gold'

describe('수수료 비교 — 100만 원', () => {
  const [namu, mirae] = BROKERS
  it('나무증권은 오래 둬도 4,400원', () => {
    expect(brokerCost(namu, 1_000_000, 1)).toBe(4_400)
    expect(brokerCost(namu, 1_000_000, 5)).toBe(4_400)
  })
  it('미래에셋은 1년 4,103원, 3년 5,709원 — 1~2년쯤부터 나무증권이 싸다', () => {
    expect(brokerCost(mirae, 1_000_000, 1)).toBe(4_103)
    expect(brokerCost(mirae, 1_000_000, 3)).toBe(5_709)
    expect(brokerCost(mirae, 1_000_000, 1.5)).toBeGreaterThan(4_400)
  })
  it('금방은 사고 바로 팔면 약 14.5만 원 덜 받는다', () => {
    expect(shopCost(1_000_000)).toBe(145_140)
  })
})

describe('금 사는 곳 비교', () => {
  it('돌반지 13돈 = 48.75g', () => {
    expect(computeGold(DEFAULT_GOLD).grams).toBe(48.75)
  })

  it('금방 살 때 976만, 팔 때 835만, 앱으로 사면 874만', () => {
    const r = computeGold(DEFAULT_GOLD)
    expect(r.shopBuy).toBe(9_763_000)
    expect(r.shopSell).toBe(8_346_000)
    // 48.75g × 178,960 = 8,724,300 ± 수수료 0.22%
    expect(r.krxBuy).toBe(8_743_493)
    expect(r.krxSell).toBe(8_705_107)
    expect(r.buySaving).toBe(1_019_507)
  })

  it('1돈도 같은 무게로 비교 — 앱이 더 비싸 보이지 않는다', () => {
    const r = computeGold({ ...DEFAULT_GOLD, don: 1 })
    expect(r.krxBuy).toBeLessThan(r.shopBuy)
  })
})
