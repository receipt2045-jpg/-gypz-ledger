import { RECIPES, type Recipe } from './recipes'

/**
 * 제철 재료 달력 (2026-11-26) — 흔히 그 달에 많이 나고 값이 내려가는 재료.
 * ing가 있으면 레시피 재료 id — 누르면 그 재료로 만드는 레시피를 보여 준다.
 */
export interface SeasonItem {
  name: string
  kind: 'sea' | 'veg' | 'fruit'
  ing?: string
}

const S = (name: string, kind: SeasonItem['kind'], ing?: string): SeasonItem => ({ name, kind, ing })

export const SEASON: Record<number, SeasonItem[]> = {
  1: [S('굴', 'sea', 'oyster'), S('삼치', 'sea', 'samchi'), S('꼬막', 'sea'), S('무', 'veg', 'mu'), S('시금치', 'veg', 'spinach'), S('브로콜리', 'veg', 'broccoli'), S('귤', 'fruit'), S('딸기', 'fruit')],
  2: [S('굴', 'sea', 'oyster'), S('삼치', 'sea', 'samchi'), S('꼬막', 'sea'), S('시금치', 'veg', 'spinach'), S('브로콜리', 'veg', 'broccoli'), S('냉이', 'veg'), S('딸기', 'fruit'), S('한라봉', 'fruit')],
  3: [S('바지락', 'sea'), S('주꾸미', 'sea'), S('냉이', 'veg'), S('달래', 'veg'), S('시금치', 'veg', 'spinach'), S('브로콜리', 'veg', 'broccoli'), S('딸기', 'fruit')],
  4: [S('바지락', 'sea'), S('주꾸미', 'sea'), S('쑥', 'veg'), S('두릅', 'veg'), S('양배추', 'veg'), S('딸기', 'fruit'), S('참외', 'fruit')],
  5: [S('멸치', 'sea', 'anchovy'), S('바지락', 'sea'), S('양파', 'veg', 'onion'), S('감자', 'veg', 'potato'), S('완두콩', 'veg'), S('참외', 'fruit'), S('토마토', 'fruit')],
  6: [S('멸치', 'sea', 'anchovy'), S('오징어', 'sea'), S('감자', 'veg', 'potato'), S('애호박', 'veg', 'zucchini'), S('양파', 'veg', 'onion'), S('오이', 'veg'), S('수박', 'fruit'), S('자두', 'fruit')],
  7: [S('오징어', 'sea'), S('장어', 'sea'), S('애호박', 'veg', 'zucchini'), S('감자', 'veg', 'potato'), S('옥수수', 'veg'), S('가지', 'veg'), S('수박', 'fruit'), S('복숭아', 'fruit')],
  8: [S('오징어', 'sea'), S('전복', 'sea'), S('애호박', 'veg', 'zucchini'), S('가지', 'veg'), S('옥수수', 'veg'), S('복숭아', 'fruit'), S('포도', 'fruit')],
  9: [S('고등어', 'sea', 'mackerel'), S('꽃게', 'sea'), S('전어', 'sea'), S('버섯', 'veg', 'mushroom'), S('고구마', 'veg'), S('배', 'fruit'), S('사과', 'fruit')],
  10: [S('고등어', 'sea', 'mackerel'), S('삼치', 'sea', 'samchi'), S('꽃게', 'sea'), S('무', 'veg', 'mu'), S('배추', 'veg', 'cabbage'), S('버섯', 'veg', 'mushroom'), S('고구마', 'veg'), S('사과', 'fruit')],
  11: [S('굴', 'sea', 'oyster'), S('고등어', 'sea', 'mackerel'), S('삼치', 'sea', 'samchi'), S('무', 'veg', 'mu'), S('배추', 'veg', 'cabbage'), S('시금치', 'veg', 'spinach'), S('브로콜리', 'veg', 'broccoli'), S('귤', 'fruit'), S('사과', 'fruit')],
  12: [S('굴', 'sea', 'oyster'), S('고등어', 'sea', 'mackerel'), S('삼치', 'sea', 'samchi'), S('꼬막', 'sea'), S('무', 'veg', 'mu'), S('배추', 'veg', 'cabbage'), S('시금치', 'veg', 'spinach'), S('브로콜리', 'veg', 'broccoli'), S('귤', 'fruit')],
}

export const SEASON_KIND_NAME: Record<SeasonItem['kind'], string> = {
  sea: '생선·해산물',
  veg: '채소',
  fruit: '과일',
}

/** 이 재료를 쓰는 레시피 */
export const recipesUsing = (ing: string): Recipe[] =>
  RECIPES.filter((r) => r.role !== 'one' && r.ingredients.some(([id]) => id === ing))
