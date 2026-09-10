import type { AssetGroup, AssetItem } from '../types'

/**
 * 자산 구성 비율 — "우리집 돈이 어디에 얼마나 들어 있나".
 *
 * 그룹은 두 덩어리로 나눈다. 모아불리라는 이름 그대로,
 * 모으는 돈(현금·연금)과 불리는 돈(주식·부동산)이다.
 * 소비재(차·가전)는 어느 쪽도 아니라서 '기타'로 묶는다 —
 * 빼버리면 합이 100%가 안 되고 "내 차 500만원은 어디 갔지"가 된다.
 */

export type CompoKind = 'save' | 'grow' | 'other'

const KIND_OF: Record<AssetGroup, CompoKind> = {
  cash: 'save',
  pension: 'save',
  stock: 'grow',
  realestate: 'grow',
  consumable: 'other',
}

/**
 * 부동산 그룹에 들어 있어도 전세·월세 보증금은 '불리는 돈'이 아니다 — 돌려받을 돈이다.
 * 신혼부부는 전세보증금이 자산의 대부분이라, 이걸 투자로 세면
 * "불리는 쪽 비중이 큰 편이에요"라는 엉뚱한 말이 나온다 (직접 눌러보다 발견).
 * 그룹을 새로 만들지 않고 이름으로 가려 '보증금' 칸으로 뺀다.
 */
const DEPOSIT_RE = /전세|월세|보증금|임차/
export const DEPOSIT = 'deposit' as const
export type CompoGroup = AssetGroup | typeof DEPOSIT

/** 막대에 이름을 달아 보여주는 칸 (최대 5칸). 나머지는 전부 '기타' 한 칸. */
const NAMED: CompoGroup[] = ['cash', 'pension', DEPOSIT, 'stock', 'realestate']

const kindOf = (g: CompoGroup): CompoKind => (g === DEPOSIT ? 'save' : KIND_OF[g])
const groupOf = (it: AssetItem): CompoGroup =>
  it.group === 'realestate' && DEPOSIT_RE.test(it.name) ? DEPOSIT : it.group

export interface CompoSlice {
  group: CompoGroup | null // null = 기타
  kind: CompoKind
  amount: number
  percent: number // 정수, 다 더하면 정확히 100
}

export interface Composition {
  slices: CompoSlice[] // 모으는 돈 → 불리는 돈 → 기타 순
  total: number
  savePercent: number
  growPercent: number
}

/**
 * 반올림하면 99%나 101%가 되기 쉽다. 큰 나머지부터 1%씩 나눠주면
 * 합이 정확히 100이 된다(최대잉여법). 화면에 뜨는 숫자라 어긋나면 바로 티가 난다.
 */
function toPercents(amounts: number[], total: number): number[] {
  if (total <= 0) return amounts.map(() => 0)
  const raw = amounts.map((a) => (a * 100) / total)
  const floors = raw.map(Math.floor)
  let left = 100 - floors.reduce((a, b) => a + b, 0)
  const order = raw
    .map((v, i) => ({ i, rem: v - Math.floor(v) }))
    .sort((a, b) => b.rem - a.rem)
  const out = [...floors]
  for (const { i } of order) {
    if (left <= 0) break
    out[i] += 1
    left -= 1
  }
  return out
}

export function buildComposition(items: AssetItem[]): Composition {
  const sums = new Map<CompoGroup, number>()
  let other = 0
  for (const it of items) {
    if (it.amount <= 0) continue
    const g = groupOf(it)
    if (NAMED.includes(g)) sums.set(g, (sums.get(g) ?? 0) + it.amount)
    else other += it.amount
  }

  const named = NAMED.filter((g) => (sums.get(g) ?? 0) > 0).map((g) => ({
    group: g as CompoGroup | null,
    kind: kindOf(g),
    amount: sums.get(g)!,
  }))
  // 모으는 돈이 먼저, 그 안에서는 큰 것부터. 기타는 항상 맨 끝.
  const rank: Record<CompoKind, number> = { save: 0, grow: 1, other: 2 }
  named.sort((a, b) => rank[a.kind] - rank[b.kind] || b.amount - a.amount)

  const rows = other > 0 ? [...named, { group: null, kind: 'other' as const, amount: other }] : named
  const total = rows.reduce((a, r) => a + r.amount, 0)
  const percents = toPercents(
    rows.map((r) => r.amount),
    total,
  )

  const slices: CompoSlice[] = rows.map((r, i) => ({ ...r, percent: percents[i] }))
  const sumOf = (k: CompoKind) =>
    slices.filter((s) => s.kind === k).reduce((a, s) => a + s.percent, 0)

  return { slices, total, savePercent: sumOf('save'), growPercent: sumOf('grow') }
}

/**
 * 막대 밑에 붙는 한 줄.
 *
 * 판단을 얹는 자리라 조심스럽게 쓴다 — 자산 사정은 집마다 다르고,
 * 신혼 초에 현금이 많은 건 이상한 게 아니라 정상이다.
 * 애매한 구간에는 아무 말도 붙이지 않는다.
 */
export function compositionNote(c: Composition): string {
  if (c.total <= 0) return ''
  const head = `모으는 돈 ${c.savePercent}% · 불리는 돈 ${c.growPercent}%`
  // 차·가전(기타)이 절반을 넘으면 모으는/불리는 비율로 뭐라 말할 자격이 없다.
  // 남편 탭에서 자동차 69%인데 "모으는 데 집중하고 있어요"가 뜨던 걸 막는다.
  const otherPercent = 100 - c.savePercent - c.growPercent
  if (otherPercent >= 50) return `${head} · 소비재 ${otherPercent}%. 차·가전 같은 소비재가 큰 편이에요`
  if (c.growPercent === 0) return `${head}. 아직은 모으는 데 집중하고 있어요`
  if (c.savePercent >= 70) return `${head}. 현금이 많은 편이에요. 신혼 초엔 자연스러운 모습이에요`
  if (c.growPercent >= 60) return `${head}. 불리는 쪽 비중이 큰 편이에요`
  return head
}
