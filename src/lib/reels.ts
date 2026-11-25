import type { Meal } from './mealPlan'

/**
 * 릴스 편별 한 상 (2026-11-26) — 「3살 아기 / 10만원 / 집밥레시피」 시리즈.
 * 댓글 나눔 링크는 moabuli.com/recipes/reel-<id> 로 쓴다.
 * 장보기 금액은 영상에 나온 금액이 정해지면 spent에 넣는다 (없으면 예상값으로 보여 준다).
 */
export interface ReelEpisode {
  id: string
  no: number
  /** 'YYYY-MM-DD' 올린 날 */
  date: string
  title: string
  meal: Meal
  /** 영상에서 쓴 장보기 금액(원) — 아직 모르면 비워 둔다 */
  spent?: number
  /** 영상 속 한 줄 — 레시피 위에 작게 */
  note: string
}

export const REELS: ReelEpisode[] = [
  {
    id: '1123',
    no: 1,
    date: '2026-11-23',
    title: '굴 미역국 · 간장 돼지불고기 · 애호박볶음',
    meal: { main: 'ganjang-dwaeji-bulgogi', sub: 'aehobak-bokkeum', soup: 'gul-miyeokguk' },
    note: '양념은 세 살 아기가 넣고, 미역도 아기가 불렸어요. 아기 식판까지 한 번에 차렸어요.',
  },
]

export const reelById = (id: string) => REELS.find((r) => r.id === id)
