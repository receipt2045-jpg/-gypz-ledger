/**
 * 결영이네 집밥 레시피 (2026-11-01) — 한 끼 얼마 + 영양소.
 *
 * 레시피(재료·순서)는 흔한 집밥을 새로 쓴 것이다. 다른 레시피 사이트의 글·사진은 옮기지 않는다.
 * 영양: 식약처 「전국통합식품영양성분정보(음식) 표준데이터」(공공데이터포털 15100070) 100g(ml)당 값 × 1인분 양.
 *   음식마다 쓴 식품코드를 같이 적어 둔다 — 값을 다시 확인할 때 그 코드로 찾는다.
 * 가격: 쿠팡파트너스 검색으로 재료 한 봉지 값을 받아 1g(ml·개)당 값으로 바꾼 것(recipe_prices 표).
 *   여기는 "얼마나 쓰나"만 갖고, 값은 표에서 읽어 곱한다.
 */

/** 재료 — id는 recipe_prices 표의 ingredient와 같다 */
export interface Ingredient {
  id: string
  name: string
  /** 표의 1단위가 무엇인지 — g, ml, 개 */
  unit: 'g' | 'ml' | '개'
  /** 1큰술이 몇 g(ml)인지 — 양념은 큰술로 보여 준다 */
  spoon?: number
  /** 한 개(한 모·한 대)가 몇 g인지 — 채소는 "1/2개"로 보여 준다 */
  piece?: { g: number; word: string }
}

export const INGREDIENTS: Record<string, Ingredient> = {
  rice: { id: 'rice', name: '밥', unit: 'g' },
  kimchi: { id: 'kimchi', name: '배추김치', unit: 'g' },
  pork: { id: 'pork', name: '돼지고기 앞다리살', unit: 'g' },
  tofu: { id: 'tofu', name: '두부', unit: 'g', piece: { g: 300, word: '모' } },
  greenOnion: { id: 'greenOnion', name: '대파', unit: 'g', piece: { g: 100, word: '대' } },
  onion: { id: 'onion', name: '양파', unit: 'g', piece: { g: 200, word: '개' } },
  zucchini: { id: 'zucchini', name: '애호박', unit: '개', piece: { g: 1, word: '개' } },
  potato: { id: 'potato', name: '감자', unit: 'g', piece: { g: 150, word: '개' } },
  carrot: { id: 'carrot', name: '당근', unit: 'g', piece: { g: 200, word: '개' } },
  doenjang: { id: 'doenjang', name: '된장', unit: 'g', spoon: 18 },
  seaweed: { id: 'seaweed', name: '자른 미역', unit: 'g' },
  beefSoup: { id: 'beefSoup', name: '소고기 국거리', unit: 'g' },
  beefBulgogi: { id: 'beefBulgogi', name: '소고기 불고기용', unit: 'g' },
  chicken: { id: 'chicken', name: '닭볶음탕용 닭', unit: 'g' },
  curry: { id: 'curry', name: '카레 가루', unit: 'g' },
  egg: { id: 'egg', name: '달걀', unit: '개' },
  gochujang: { id: 'gochujang', name: '고추장', unit: 'g', spoon: 18 },
  gochugaru: { id: 'gochugaru', name: '고춧가루', unit: 'g', spoon: 7 },
  soySauce: { id: 'soySauce', name: '진간장', unit: 'ml', spoon: 15 },
  soupSoy: { id: 'soupSoy', name: '국간장', unit: 'ml', spoon: 15 },
  sugar: { id: 'sugar', name: '설탕', unit: 'g', spoon: 12 },
  garlic: { id: 'garlic', name: '다진 마늘', unit: 'g', spoon: 10 },
  sesameOil: { id: 'sesameOil', name: '참기름', unit: 'ml', spoon: 15 },
  oil: { id: 'oil', name: '식용유', unit: 'ml', spoon: 15 },
}

/** 100g(ml)당 영양 — 식약처 음식 DB 값 그대로 */
export interface Per100 {
  /** 식품코드 */
  code: string
  name: string
  kcal: number
  carb: number
  protein: number
  fat: number
  sodium: number
}

/** 음식 사진 — 위키미디어 공용(Commons)에서 출처만 밝히면 상업적으로 써도 되는 것(CC0·CC BY·CC BY-SA)만 */
export interface Photo {
  src: string
  /** 사진 설명 페이지 */
  page: string
  license: string
  author: string
}

export interface Recipe {
  slug: string
  name: string
  emoji: string
  photo: Photo
  minutes: number
  /** 한 줄 소개 */
  sub: string
  /** 2인분 기준 재료 양 (재료 단위 그대로) */
  ingredients: [id: string, amount: number][]
  steps: string[]
  /** 1인분 양(g 또는 ml)과 그 음식의 영양 */
  serving: number
  per100: Per100
  /** 밥이 따로 필요한 음식이면 밥 1공기를 한 끼에 더한다 */
  withRice: boolean
}

/** 밥 한 공기 = 쌀밥 210g, 쌀로는 약 90g */
export const RICE_BOWL = { cookedG: 210, rawG: 90 }
export const RICE_PER100: Per100 = {
  code: 'D301-022000000-0001',
  name: '쌀밥',
  kcal: 166,
  carb: 37.33,
  protein: 3.36,
  fat: 0.32,
  sodium: 0,
}

export const RECIPES: Recipe[] = [
  {
    slug: 'kimchi-jjigae',
    name: '돼지고기 김치찌개',
    emoji: '🍲',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Kimchi_jjigae_-_San_Francisco%2C_CA.jpg/960px-Kimchi_jjigae_-_San_Francisco%2C_CA.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Kimchi_jjigae_-_San_Francisco,_CA.jpg',
      license: 'CC0',
      author: 'Daderot',
    },
    minutes: 25,
    sub: '신김치 하나면 끝나는 기본 찌개',
    ingredients: [
      ['kimchi', 200],
      ['pork', 150],
      ['tofu', 150],
      ['onion', 100],
      ['greenOnion', 50],
      ['gochugaru', 7],
      ['garlic', 10],
      ['oil', 15],
    ],
    steps: [
      '냄비에 식용유를 두르고 돼지고기를 볶아요.',
      '고기 겉이 익으면 김치를 넣고 3분 더 볶아요.',
      '물 500ml, 고춧가루, 다진 마늘, 양파를 넣고 15분 끓여요.',
      '두부와 대파를 넣고 5분 더 끓이면 끝이에요.',
    ],
    serving: 300,
    per100: {
      code: 'D706-266101700-0001',
      name: '김치찌개_돼지고기_두부',
      kcal: 35,
      carb: 2.36,
      protein: 3.3,
      fat: 1.33,
      sodium: 264,
    },
    withRice: true,
  },
  {
    slug: 'doenjang-jjigae',
    name: '애호박 된장찌개',
    emoji: '🥘',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/0/01/Doenjang-jjigae_2.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Doenjang-jjigae_2.jpg',
      license: 'CC BY 4.0',
      author: '스물셋',
    },
    minutes: 20,
    sub: '냉장고 채소로 끓이는 된장찌개',
    ingredients: [
      ['zucchini', 0.5],
      ['tofu', 150],
      ['potato', 150],
      ['onion', 100],
      ['greenOnion', 30],
      ['doenjang', 36],
      ['garlic', 10],
    ],
    steps: [
      '냄비에 물 500ml를 붓고 된장을 풀어요.',
      '감자를 먼저 넣고 5분 끓여요.',
      '애호박, 양파, 다진 마늘을 넣고 7분 더 끓여요.',
      '두부와 대파를 넣고 3분 끓이면 끝이에요.',
    ],
    serving: 300,
    per100: {
      code: 'D706-275380000-0001',
      name: '된장찌개_호박',
      kcal: 38,
      carb: 3.88,
      protein: 3.7,
      fat: 0.91,
      sodium: 210,
    },
    withRice: true,
  },
  {
    slug: 'miyeokguk',
    name: '소고기 미역국',
    emoji: '🥣',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Korean_soup-Miyeokguk-01.jpg/960px-Korean_soup-Miyeokguk-01.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Korean_soup-Miyeokguk-01.jpg',
      license: 'CC BY 2.0',
      author: 'karendotcom127',
    },
    minutes: 30,
    sub: '아이도 잘 먹는 순한 국',
    ingredients: [
      ['seaweed', 10],
      ['beefSoup', 100],
      ['soupSoy', 15],
      ['garlic', 5],
      ['sesameOil', 15],
    ],
    steps: [
      '미역을 물에 10분 불린 뒤 헹궈 물기를 짜요.',
      '냄비에 참기름을 두르고 소고기를 볶아요.',
      '미역을 넣고 2분 더 볶은 뒤 물 800ml를 부어요.',
      '국간장, 다진 마늘을 넣고 20분 끓여요. 싱거우면 소금으로 맞춰요.',
    ],
    serving: 350,
    per100: {
      code: 'D705-223240000-0001',
      name: '미역국_소고기',
      kcal: 17,
      carb: 0.7,
      protein: 1.45,
      fat: 1.05,
      sodium: 215,
    },
    withRice: true,
  },
  {
    slug: 'jeyuk',
    name: '제육볶음',
    emoji: '🌶️',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Jeyuk-bokkeum_1.jpg/960px-Jeyuk-bokkeum_1.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Jeyuk-bokkeum_1.jpg',
      license: 'CC BY-SA 2.0',
      author: 'Charles Haynes',
    },
    minutes: 25,
    sub: '밥도둑 1순위',
    ingredients: [
      ['pork', 300],
      ['onion', 100],
      ['greenOnion', 50],
      ['gochujang', 36],
      ['gochugaru', 7],
      ['soySauce', 15],
      ['sugar', 12],
      ['garlic', 10],
      ['oil', 15],
    ],
    steps: [
      '고추장, 고춧가루, 간장, 설탕, 다진 마늘을 섞어 양념을 만들어요.',
      '돼지고기에 양념을 버무려 10분 둬요.',
      '팬에 식용유를 두르고 고기를 센 불에 볶아요.',
      '고기가 거의 익으면 양파, 대파를 넣고 3분 더 볶아요.',
    ],
    serving: 150,
    per100: {
      code: 'D710-529000000-0001',
      name: '제육볶음',
      kcal: 148,
      carb: 13.71,
      protein: 15.4,
      fat: 3.7,
      sodium: 476,
    },
    withRice: true,
  },
  {
    slug: 'bulgogi',
    name: '소불고기',
    emoji: '🥩',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/7/76/Bulgogi_3.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Bulgogi_3.jpg',
      license: 'CC BY 2.0',
      author: 'Debbie Tingzon',
    },
    minutes: 25,
    sub: '안 매워서 아이 반찬으로 좋아요',
    ingredients: [
      ['beefBulgogi', 300],
      ['onion', 100],
      ['carrot', 50],
      ['greenOnion', 30],
      ['soySauce', 45],
      ['sugar', 18],
      ['garlic', 10],
      ['sesameOil', 15],
    ],
    steps: [
      '간장, 설탕, 다진 마늘, 참기름을 섞어 양념을 만들어요.',
      '소고기에 양념을 버무려 15분 둬요.',
      '팬에 고기와 양파, 당근을 넣고 중불에서 볶아요.',
      '국물이 졸아들면 대파를 넣고 1분 더 볶아요.',
    ],
    serving: 150,
    per100: {
      code: 'D108-386000000-0001',
      name: '소불고기',
      kcal: 170,
      carb: 4.26,
      protein: 16.41,
      fat: 9.66,
      sodium: 418,
    },
    withRice: true,
  },
  {
    slug: 'dakbokkeumtang',
    name: '닭볶음탕',
    emoji: '🍗',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/f/f7/13-hadirector1_hoya00571_hoya0057.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:13-hadirector1_hoya00571_hoya0057.jpg',
      license: 'CC0',
      author: 'Derek Woodward',
    },
    minutes: 45,
    sub: '주말 저녁 온 가족 메뉴',
    ingredients: [
      ['chicken', 500],
      ['potato', 150],
      ['carrot', 100],
      ['onion', 100],
      ['greenOnion', 30],
      ['gochujang', 18],
      ['gochugaru', 14],
      ['soySauce', 30],
      ['sugar', 12],
      ['garlic', 10],
    ],
    steps: [
      '닭은 끓는 물에 3분 데쳐 헹궈요.',
      '고추장, 고춧가루, 간장, 설탕, 다진 마늘을 섞어 양념을 만들어요.',
      '냄비에 닭, 양념, 물 400ml를 넣고 15분 끓여요.',
      '감자, 당근, 양파를 넣고 15분 더 졸이다가 대파를 올려요.',
    ],
    serving: 300,
    per100: {
      code: 'D111-514000000-0001',
      name: '닭볶음탕',
      kcal: 111,
      carb: 8.52,
      protein: 11.91,
      fat: 3.22,
      sodium: 376,
    },
    withRice: true,
  },
  {
    slug: 'curry',
    name: '돼지고기 카레라이스',
    emoji: '🍛',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Curry_rice.jpg/960px-Curry_rice.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Curry_rice.jpg',
      license: 'CC0',
      author: 'wizdata',
    },
    minutes: 30,
    sub: '한 냄비로 아이 밥까지 해결',
    ingredients: [
      ['curry', 50],
      ['pork', 100],
      ['potato', 150],
      ['carrot', 100],
      ['onion', 200],
      ['oil', 15],
      ['rice', 180],
    ],
    steps: [
      '돼지고기와 채소를 한입 크기로 썰어요.',
      '냄비에 식용유를 두르고 고기, 양파, 감자, 당근 순서로 볶아요.',
      '물 350ml를 붓고 채소가 익을 때까지 15분 끓여요.',
      '불을 줄이고 카레 가루를 풀어 5분 저은 뒤 밥에 얹어요.',
    ],
    serving: 500,
    per100: {
      code: 'D701-044140000-0001',
      name: '카레라이스_돼지고기',
      kcal: 100,
      carb: 18.4,
      protein: 2.64,
      fat: 1.59,
      sodium: 97,
    },
    withRice: false,
  },
  {
    slug: 'kimchi-fried-rice',
    name: '김치볶음밥',
    emoji: '🍳',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Kimchi_fried_rice.jpg/960px-Kimchi_fried_rice.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Kimchi_fried_rice.jpg',
      license: 'CC0',
      author: 'Sharon Ang',
    },
    minutes: 15,
    sub: '남은 밥과 김치로 15분',
    ingredients: [
      ['kimchi', 150],
      ['rice', 180],
      ['egg', 2],
      ['greenOnion', 30],
      ['soySauce', 5],
      ['oil', 15],
      ['sesameOil', 5],
    ],
    steps: [
      '팬에 식용유를 두르고 송송 썬 대파를 볶아 파기름을 내요.',
      '잘게 썬 김치를 넣고 3분 볶아요.',
      '밥을 넣고 간장을 둘러 골고루 볶은 뒤 참기름을 뿌려요.',
      '달걀 프라이를 하나씩 올려요.',
    ],
    serving: 350,
    per100: {
      code: 'D401-059200000-0001',
      name: '김치 볶음밥_모듬',
      kcal: 130,
      carb: 21.5,
      protein: 3.8,
      fat: 2.79,
      sodium: 152,
    },
    withRice: false,
  },
  {
    slug: 'gyeran-mari',
    name: '달걀말이',
    emoji: '🥚',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Gyeran-mari_3.jpg/960px-Gyeran-mari_3.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Gyeran-mari_3.jpg',
      license: 'CC BY 4.0',
      author: 'Asadal',
    },
    minutes: 15,
    sub: '달걀 4개로 만드는 아이 반찬',
    ingredients: [
      ['egg', 4],
      ['greenOnion', 20],
      ['carrot', 30],
      ['oil', 10],
    ],
    steps: [
      '달걀을 풀고 잘게 썬 대파, 당근, 소금 한 꼬집을 섞어요.',
      '약불로 달군 팬에 기름을 얇게 두르고 달걀물의 1/3을 부어요.',
      '반쯤 익으면 한쪽 끝부터 돌돌 말아요.',
      '남은 달걀물을 두 번 나눠 부으며 이어 말아요.',
    ],
    serving: 100,
    per100: {
      code: 'D109-416000000-0001',
      name: '달걀말이',
      kcal: 193,
      carb: 1.45,
      protein: 17.21,
      fat: 13.21,
      sodium: 449,
    },
    withRice: true,
  },
]

/** 레시피 재료 양의 기준 인원 */
export const BASE_SERVINGS = 2
export const SERVING_OPTIONS = [2, 3, 4] as const

export interface Nutrition {
  kcal: number
  carb: number
  protein: number
  fat: number
  sodium: number
}

const scale = (p: Per100, g: number): Nutrition => ({
  kcal: (p.kcal * g) / 100,
  carb: (p.carb * g) / 100,
  protein: (p.protein * g) / 100,
  fat: (p.fat * g) / 100,
  sodium: (p.sodium * g) / 100,
})

/** 한 사람 한 끼 영양 — 밥이 필요한 음식이면 밥 1공기 포함 */
export function mealNutrition(r: Recipe): Nutrition {
  const dish = scale(r.per100, r.serving)
  if (!r.withRice) return dish
  const rice = scale(RICE_PER100, RICE_BOWL.cookedG)
  return {
    kcal: dish.kcal + rice.kcal,
    carb: dish.carb + rice.carb,
    protein: dish.protein + rice.protein,
    fat: dish.fat + rice.fat,
    sodium: dish.sodium + rice.sodium,
  }
}

/**
 * 하루 영양성분 기준치 (식품 등의 표시기준, 식약처) — 한 끼가 하루의 몇 %인지 보여 줄 때 쓴다.
 * 열량은 성인 하루 2,000kcal 기준.
 */
export const DAILY = { kcal: 2000, carb: 324, protein: 55, fat: 54, sodium: 2000 }

/** n인분 재료 양 — 밥이 필요한 음식이면 쌀을 1인 90g씩 더한다 */
export function ingredientsFor(r: Recipe, people: number): [string, number][] {
  const k = people / BASE_SERVINGS
  const list: [string, number][] = r.ingredients.map(([id, a]) => [id, a * k])
  if (r.withRice) list.push(['rice', RICE_BOWL.rawG * people])
  return list
}

/** 재료 1단위(g·ml·개) 값 */
export type UnitPrices = Record<string, number>

export interface MealCost {
  /** 모든 재료 값이 있으면 합계, 하나라도 없으면 null */
  total: number | null
  perPerson: number | null
  /** 값이 없는 재료 */
  missing: string[]
}

/** 쓴 만큼만 계산 — 양념 한 병을 다 사는 값이 아니라 1큰술 값 */
export function mealCost(r: Recipe, people: number, prices: UnitPrices): MealCost {
  let total = 0
  const missing: string[] = []
  for (const [id, amount] of ingredientsFor(r, people)) {
    const unit = prices[id]
    if (unit === undefined) missing.push(id)
    else total += unit * amount
  }
  if (missing.length) return { total: null, perPerson: null, missing }
  const rounded = Math.round(total / 10) * 10
  return { total: rounded, perPerson: Math.round(total / people / 10) * 10, missing }
}

/** 재료 양을 사람이 읽는 말로 — "150g (1/2모)", "2큰술", "4개" */
export function amountText(id: string, amount: number): string {
  const ing = INGREDIENTS[id]
  if (!ing) return `${Math.round(amount)}`
  if (id === 'rice') return `${fraction(amount / RICE_BOWL.rawG)}공기 (쌀 ${Math.round(amount)}g)`
  if (ing.spoon) {
    const sp = Math.round((amount / ing.spoon) * 2) / 2
    return sp >= 0.5 ? `${trim(sp)}큰술` : '약간'
  }
  if (ing.unit === '개' && !ing.piece) return `${trim(Math.round(amount * 2) / 2)}개`
  if (ing.piece && ing.unit === '개') return `${fraction(amount)}${ing.piece.word}`
  const g = `${Math.round(amount)}${ing.unit}`
  if (!ing.piece) return g
  return `${g} (${fraction(amount / ing.piece.g)}${ing.piece.word})`
}

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''))

/** 0.5 → "1/2", 1.25 → "1과 1/4" — 1/4 단위로 반올림 */
function fraction(x: number): string {
  const q = Math.max(0.25, Math.round(x * 4) / 4)
  const whole = Math.floor(q)
  const rest = q - whole
  const part = rest === 0.25 ? '1/4' : rest === 0.5 ? '1/2' : rest === 0.75 ? '3/4' : ''
  if (!whole) return part
  return part ? `${whole}과 ${part}` : String(whole)
}

export const recipeBySlug = (slug: string) => RECIPES.find((r) => r.slug === slug)
