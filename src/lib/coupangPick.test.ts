import { describe, expect, it } from 'vitest'
import { bundleCount, pickProduct } from './coupangPick'

const item = (productName: string, productPrice: number) => ({
  productName,
  productPrice,
  productUrl: 'https://link.coupang.com/x',
})

describe('쿠팡 검색 결과에서 재료 고르기', () => {
  it('묶음 수 읽기', () => {
    expect(bundleCount('국산콩 부침두부 300g x 2개', '300g')).toBe(2)
    expect(bundleCount('풀무원 두부 300g, 3개입', '300g')).toBe(3)
    expect(bundleCount('국산 두부 300g', '300g')).toBe(1)
    expect(bundleCount('진간장 1.8L 1개', '1.8L')).toBe(1)
  })

  it('용량이 이름에 없는 상품은 고르지 않는다', () => {
    expect(pickProduct([item('맛있는 두부 한 모', 1500)], '300g', 300)).toBeNull()
  })

  it('낱개가 있으면 낱개 먼저, 낱개끼리는 1g당 싼 것 — 묶음은 나눠서 1g 값', () => {
    const p = pickProduct(
      [item('부침두부 300g', 2400), item('부침두부 300g', 2000), item('부침두부 300g x 2개', 3000)],
      '300g',
      300,
    )
    expect(p?.count).toBe(1)
    expect(p?.item.productPrice).toBe(2000)
    expect(pickProduct([item('부침두부 300g x 2개', 3000)], '300g', 300)?.unitPrice).toBe(5)
  })

  it('대소문자·띄어쓰기가 달라도 용량을 알아본다', () => {
    expect(pickProduct([item('샘표 진간장 1.8 l', 9000)], '1.8L', 1800)?.unitPrice).toBe(5)
  })

  it('엉뚱한 상품·대용량은 고르지 않는다 (11-26 실제로 들어갔던 것)', () => {
    const k = (name: string, price: number, kw: string, size: string, amt: number) =>
      pickProduct([item(name, price)], size, amt, kw)
    expect(k('청미담 순살 고등어 1박스 (400g x 4개입) 냉동', 63600, '순살 고등어 400g', '400g', 400)).toBeNull()
    expect(k('초심 강아지 슬라이스 간식, 오리, 400g, 10개', 37900, '오리 슬라이스 400g', '400g', 400)).toBeNull()
    expect(k('델라미코 마늘100% 건조 갈릭후레이크 600g', 21700, '양파 600g', '600g', 600)).toBeNull()
    expect(k('산들약초 국내산 브로콜리 가루 분말, 300g, 1개', 8850, '브로콜리 300g', '300g', 300)).toBeNull()
    expect(k('국내산 강원도 알배기 알배추, 12개, 800g', 32500, '알배추 800g', '800g', 800)).toBeNull()
    expect(k('해피유통 고춧가루 김치용, 1개, 500g', 6890, '고춧가루 500g', '500g', 500)?.count).toBe(1)
    expect(k('국내산 순살 고등어 400g, 2개', 15800, '순살 고등어 400g', '400g', 400)?.count).toBe(2)
  })
})
