/**
 * 쿠팡 검색 결과에서 재료 한 봉지 고르기 (2026-11-01, 11-26 고침).
 * Edge Function coupang-prices가 같은 규칙을 쓴다 — 여기를 고치면 그쪽도 같이 고친다.
 *
 * 1. 상품 이름에 용량(size_token, 예 '300g')이 있는 것만 본다 — 용량을 모르면 1g 값을 못 낸다
 * 2. 검색어 낱말(용량 빼고)이 이름에 다 들어 있어야 한다 — '양파'로 찾았는데 마늘 후레이크가 오지 않게
 * 3. 강아지 간식·가루·건조품처럼 장보기 재료가 아닌 것은 뺀다 (검색어에 그 말이 있으면 괜찮다)
 * 4. '300g x 2개', '12개, 800g'처럼 묶음이면 그 수를 읽는다 — 2묶음 넘는 대용량은 고르지 않는다
 *    (11-26 결영: 고등어 400g×4개입 6만 원이 들어가 있었다)
 * 5. 그중 1g(ml·개)당 가장 싼 것
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

/** 장보기 재료가 아닌 상품에 흔한 말 */
export const BLOCK_WORDS = [
  '강아지', '고양이', '반려', '애견', '애묘', '펫', '사료', '간식', '트릿',
  '분말', '가루', '후레이크', '플레이크', '건조', '말린', '즙', '엑기스', '추출',
  '영양제', '캡슐', '씨앗', '모종', '장난감', '업소용',
]

/** 묶음을 이만큼 넘으면 고르지 않는다 */
export const MAX_BUNDLE = 2

/** 용량 앞뒤에 붙은 묶음 수 — 없으면 1 */
export function bundleCount(name: string, sizeToken: string): number {
  const n = norm(name)
  const t = norm(sizeToken)
  const at = n.indexOf(t)
  if (at < 0) return 1
  const after = n.slice(at + t.length).match(/^[,x×*)]?(\d{1,2})(개입|개|팩|봉|입|병|마리|박스)/)
  const before = n.slice(0, at).match(/(\d{1,2})(개입|개|팩|봉|입|병|박스)[,x×*(]?$/)
  return Math.max(1, after ? Number(after[1]) : 1, before ? Number(before[1]) : 1)
}

/** 검색어 낱말(용량 빼고)이 다 들어 있고, 막는 말이 없나 */
export function looksRight(name: string, keyword: string, sizeToken: string): boolean {
  const n = norm(name)
  const k = norm(keyword)
  const words = keyword.split(/\s+/).filter((w) => w && norm(w) !== norm(sizeToken))
  if (!words.every((w) => n.includes(norm(w)))) return false
  return !BLOCK_WORDS.some((b) => n.includes(b) && !k.includes(b))
}

export function pickProduct(
  items: SearchItem[],
  sizeToken: string,
  packAmount: number,
  keyword = '',
): Picked | null {
  const token = norm(sizeToken)
  let best: Picked | null = null
  for (const item of items) {
    if (!item.productPrice || !norm(item.productName).includes(token)) continue
    if (keyword && !looksRight(item.productName, keyword, sizeToken)) continue
    const count = bundleCount(item.productName, sizeToken)
    if (count > MAX_BUNDLE) continue
    const unitPrice = item.productPrice / (packAmount * count)
    if (!best || unitPrice < best.unitPrice) best = { item, count, unitPrice }
  }
  return best
}
