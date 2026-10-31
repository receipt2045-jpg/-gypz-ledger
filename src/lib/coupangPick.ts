/**
 * 쿠팡 검색 결과에서 재료 한 봉지 고르기 (2026-11-01).
 * Edge Function coupang-prices가 같은 규칙을 쓴다 — 여기를 고치면 그쪽도 같이 고친다.
 *
 * 1. 상품 이름에 용량(size_token, 예 '300g')이 있는 것만 본다 — 용량을 모르면 1g 값을 못 낸다
 * 2. '300g x 2개', '300g, 3개입'처럼 묶음이면 그 수만큼 나눈다
 * 3. 그중 1g(ml·개)당 가장 싼 것
 */
export interface SearchItem {
  productName: string
  productPrice: number
  productUrl: string
  isRocket?: boolean
}

export interface Picked {
  item: SearchItem
  count: number
  unitPrice: number
}

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()

/** 용량 뒤에 붙은 묶음 수 — 없으면 1 */
export function bundleCount(name: string, sizeToken: string): number {
  const n = norm(name)
  const at = n.indexOf(norm(sizeToken))
  if (at < 0) return 1
  const after = n.slice(at + norm(sizeToken).length)
  const m = after.match(/^[,x×*]?(\d{1,2})(개입|개|팩|봉|입|병)/)
  return m ? Math.max(1, Number(m[1])) : 1
}

export function pickProduct(
  items: SearchItem[],
  sizeToken: string,
  packAmount: number,
): Picked | null {
  const token = norm(sizeToken)
  let best: Picked | null = null
  for (const item of items) {
    if (!item.productPrice || !norm(item.productName).includes(token)) continue
    const count = bundleCount(item.productName, sizeToken)
    const unitPrice = item.productPrice / (packAmount * count)
    if (!best || unitPrice < best.unitPrice) best = { item, count, unitPrice }
  }
  return best
}
