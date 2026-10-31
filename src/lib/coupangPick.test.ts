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

  it('1g당 가장 싼 것 — 묶음이면 나눠서 비교', () => {
    const p = pickProduct(
      [item('부침두부 300g', 2000), item('부침두부 300g x 2개', 3000)],
      '300g',
      300,
    )
    expect(p?.count).toBe(2)
    expect(p?.unitPrice).toBe(5)
  })

  it('대소문자·띄어쓰기가 달라도 용량을 알아본다', () => {
    expect(pickProduct([item('샘표 진간장 1.8 l', 9000)], '1.8L', 1800)?.unitPrice).toBe(5)
  })
})
