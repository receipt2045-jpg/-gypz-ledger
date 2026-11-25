/**
 * 결영이네 집밥 레시피 (2026-11-01) — 한 끼 얼마 + 영양소.
 *
 * 레시피(재료·순서)는 흔한 집밥을 새로 쓴 것이다. 다른 레시피 사이트의 글·사진은 옮기지 않는다.
 * 영양: 식약처 「전국통합식품영양성분정보(음식) 표준데이터」(공공데이터포털 15100070) 100g(ml)당 값 × 1인분 양.
 *   음식마다 쓴 식품코드를 같이 적어 둔다 — 값을 다시 확인할 때 그 코드로 찾는다.
 * 가격: 쿠팡파트너스 검색으로 재료 한 봉지 값을 받아 1g(ml·개)당 값으로 바꾼 것(recipe_prices 표).
 *   여기는 "얼마나 쓰나"만 갖고, 값은 표에서 읽어 곱한다.
 */

import { MORE_INGREDIENTS, MORE_RECIPES } from './recipesMore'
import { P1_INGREDIENTS, P1_RECIPES } from './recipesP1'
import { P2_INGREDIENTS, P2_RECIPES } from './recipesP2'
import { P3_INGREDIENTS, P3_RECIPES } from './recipesP3'
import { P4_INGREDIENTS, P4_RECIPES } from './recipesP4'

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
  /**
   * 예상 한 봉지 [값(원), 몇 단위] — 2026-11 마트·쿠팡 흔한 값을 어림한 것 (2026-11-26).
   * recipe_prices 표에 실제 값이 있으면 그걸 쓰고, 없을 때만 이 값으로 "약 얼마"를 보여 준다.
   */
  est?: [price: number, units: number]
  /** 장보기 목록 칸 — 고기·생선 / 채소 / 그 밖에 (양념은 PANTRY) */
  shelf?: 'meat' | 'veg' | 'etc'
}

export const INGREDIENTS: Record<string, Ingredient> = {
  rice: { id: 'rice', name: '밥', unit: 'g' },
  kimchi: { id: 'kimchi', name: '배추김치', unit: 'g', est: [9900, 1000], shelf: 'etc' },
  pork: { id: 'pork', name: '돼지고기 앞다리살', unit: 'g', est: [9900, 600], shelf: 'meat' },
  tofu: { id: 'tofu', name: '두부', unit: 'g', piece: { g: 300, word: '모' }, est: [2000, 300], shelf: 'etc' },
  greenOnion: { id: 'greenOnion', name: '대파', unit: 'g', piece: { g: 100, word: '대' }, est: [2500, 500], shelf: 'veg' },
  onion: { id: 'onion', name: '양파', unit: 'g', piece: { g: 200, word: '개' }, est: [2500, 600], shelf: 'veg' },
  zucchini: { id: 'zucchini', name: '애호박', unit: '개', piece: { g: 1, word: '개' }, est: [1500, 1], shelf: 'veg' },
  potato: { id: 'potato', name: '감자', unit: 'g', piece: { g: 150, word: '개' }, est: [3000, 600], shelf: 'veg' },
  carrot: { id: 'carrot', name: '당근', unit: 'g', piece: { g: 200, word: '개' }, est: [1500, 300], shelf: 'veg' },
  doenjang: { id: 'doenjang', name: '된장', unit: 'g', spoon: 18 },
  seaweed: { id: 'seaweed', name: '자른 미역', unit: 'g', est: [3000, 50], shelf: 'etc' },
  beefSoup: { id: 'beefSoup', name: '소고기 국거리', unit: 'g', est: [7900, 300], shelf: 'meat' },
  beefBulgogi: { id: 'beefBulgogi', name: '소고기 불고기용', unit: 'g', est: [12900, 500], shelf: 'meat' },
  chicken: { id: 'chicken', name: '닭볶음탕용 닭', unit: 'g', est: [7900, 1000], shelf: 'meat' },
  curry: { id: 'curry', name: '카레 가루', unit: 'g', est: [2500, 100], shelf: 'etc' },
  egg: { id: 'egg', name: '달걀', unit: '개', est: [4500, 10], shelf: 'etc' },
  gochujang: { id: 'gochujang', name: '고추장', unit: 'g', spoon: 18 },
  gochugaru: { id: 'gochugaru', name: '고춧가루', unit: 'g', spoon: 7 },
  soySauce: { id: 'soySauce', name: '진간장', unit: 'ml', spoon: 15 },
  soupSoy: { id: 'soupSoy', name: '국간장', unit: 'ml', spoon: 15 },
  sugar: { id: 'sugar', name: '설탕', unit: 'g', spoon: 12 },
  garlic: { id: 'garlic', name: '다진 마늘', unit: 'g', spoon: 10 },
  sesameOil: { id: 'sesameOil', name: '참기름', unit: 'ml', spoon: 15 },
  oil: { id: 'oil', name: '식용유', unit: 'ml', spoon: 15 },
  pancakeMix: { id: 'pancakeMix', name: '부침가루', unit: 'g', spoon: 8, est: [2500, 500], shelf: 'etc' },
  salt: { id: 'salt', name: '소금', unit: 'g', spoon: 15 },
  // ── 2026-11-26 집밥 플래너 — 아이도 먹는 메인·제철 채소·순한 국 ──
  duck: { id: 'duck', name: '오리 슬라이스', unit: 'g', est: [8900, 400], shelf: 'meat' },
  chickenThigh: { id: 'chickenThigh', name: '닭다리살(정육)', unit: 'g', est: [8900, 600], shelf: 'meat' },
  porkMince: { id: 'porkMince', name: '다진 돼지고기', unit: 'g', est: [5900, 400], shelf: 'meat' },
  porkSuyuk: { id: 'porkSuyuk', name: '돼지 앞다리 수육용', unit: 'g', est: [10900, 800], shelf: 'meat' },
  mackerel: { id: 'mackerel', name: '순살 고등어', unit: 'g', est: [7900, 400], shelf: 'meat' },
  samchi: { id: 'samchi', name: '순살 삼치', unit: 'g', est: [8900, 400], shelf: 'meat' },
  salmon: { id: 'salmon', name: '생연어', unit: 'g', est: [9900, 250], shelf: 'meat' },
  oyster: { id: 'oyster', name: '생굴', unit: 'g', est: [7900, 300], shelf: 'meat' },
  enoki: { id: 'enoki', name: '팽이버섯', unit: 'g', est: [1000, 150], shelf: 'veg', piece: { g: 150, word: '봉' } },
  mushroom: { id: 'mushroom', name: '느타리버섯', unit: 'g', est: [2000, 200], shelf: 'veg' },
  mu: { id: 'mu', name: '무', unit: 'g', est: [2500, 1500], shelf: 'veg', piece: { g: 1500, word: '개' } },
  spinach: { id: 'spinach', name: '시금치', unit: 'g', est: [2500, 300], shelf: 'veg', piece: { g: 300, word: '단' } },
  beanSprout: { id: 'beanSprout', name: '콩나물', unit: 'g', est: [1500, 300], shelf: 'veg' },
  broccoli: { id: 'broccoli', name: '브로콜리', unit: 'g', est: [2500, 300], shelf: 'veg', piece: { g: 300, word: '개' } },
  cabbage: { id: 'cabbage', name: '알배추', unit: 'g', est: [2500, 800], shelf: 'veg', piece: { g: 800, word: '통' } },
  eomuk: { id: 'eomuk', name: '사각 어묵', unit: 'g', est: [2500, 300], shelf: 'etc' },
  anchovy: { id: 'anchovy', name: '잔멸치', unit: 'g', est: [4900, 100], shelf: 'etc' },
  oligo: { id: 'oligo', name: '올리고당', unit: 'ml', spoon: 15 },
  sesame: { id: 'sesame', name: '통깨', unit: 'g', spoon: 8 },
  starch: { id: 'starch', name: '전분가루', unit: 'g', spoon: 8 },
  // ── 2026-11-26 피클 100선 다시 쓰기 — 고기 부위·생선·채소·면 ──
  porkNeck: { id: 'porkNeck', name: '돼지 목살', unit: 'g', est: [11900, 500], shelf: 'meat' },
  porkRib: { id: 'porkRib', name: '돼지갈비(찜용)', unit: 'g', est: [14900, 1000], shelf: 'meat' },
  porkTenderloin: { id: 'porkTenderloin', name: '돼지 안심', unit: 'g', est: [7900, 500], shelf: 'meat' },
  porkLoin: { id: 'porkLoin', name: '돼지 등심(돈가스용)', unit: 'g', est: [7900, 500], shelf: 'meat' },
  porkBoneless: { id: 'porkBoneless', name: '감자탕용 순살 등뼈살', unit: 'g', est: [10900, 700], shelf: 'meat' },
  beefRib: { id: 'beefRib', name: '소갈비(찜용)', unit: 'g', est: [29900, 1000], shelf: 'meat' },
  beefRound: { id: 'beefRound', name: '소고기 홍두깨·우둔(장조림·산적용)', unit: 'g', est: [9900, 400], shelf: 'meat' },
  beefTenderloin: { id: 'beefTenderloin', name: '소 안심', unit: 'g', est: [12900, 200], shelf: 'meat' },
  beefMince: { id: 'beefMince', name: '다진 소고기', unit: 'g', est: [7900, 300], shelf: 'meat' },
  beefShank: { id: 'beefShank', name: '소 사태', unit: 'g', est: [12900, 500], shelf: 'meat' },
  chickenLeg: { id: 'chickenLeg', name: '닭다리(뼈 있는)', unit: 'g', est: [8900, 1000], shelf: 'meat' },
  chickenWhole: { id: 'chickenWhole', name: '영계(삼계탕용)', unit: 'g', est: [6900, 600], shelf: 'meat' },
  chickenBreast: { id: 'chickenBreast', name: '닭가슴살', unit: 'g', est: [6900, 500], shelf: 'meat' },
  chickenMince: { id: 'chickenMince', name: '다진 닭고기', unit: 'g', est: [5900, 400], shelf: 'meat' },
  smokedDuck: { id: 'smokedDuck', name: '훈제오리', unit: 'g', est: [9900, 400], shelf: 'meat' },
  hairtail: { id: 'hairtail', name: '손질 갈치', unit: 'g', est: [12900, 400], shelf: 'meat' },
  cod: { id: 'cod', name: '손질 대구', unit: 'g', est: [9900, 500], shelf: 'meat' },
  shrimp: { id: 'shrimp', name: '냉동 칵테일새우', unit: 'g', est: [8900, 300], shelf: 'meat' },
  croaker: { id: 'croaker', name: '손질 조기', unit: '개', est: [9900, 6], shelf: 'meat' },
  flounder: { id: 'flounder', name: '손질 가자미', unit: '개', est: [9900, 2], shelf: 'meat' },
  crab: { id: 'crab', name: '꽃게', unit: '개', est: [12900, 2], shelf: 'meat' },
  squid: { id: 'squid', name: '손질 오징어', unit: '개', est: [9900, 2], shelf: 'meat' },
  abalone: { id: 'abalone', name: '전복', unit: '개', est: [12900, 4], shelf: 'meat' },
  clam: { id: 'clam', name: '해감 바지락', unit: 'g', est: [5900, 500], shelf: 'meat' },
  pollack: { id: 'pollack', name: '손질 동태', unit: 'g', est: [6900, 600], shelf: 'meat' },
  driedPollack: { id: 'driedPollack', name: '북어채', unit: 'g', est: [5900, 100], shelf: 'etc' },
  mungSprout: { id: 'mungSprout', name: '숙주', unit: 'g', est: [1500, 300], shelf: 'veg' },
  lettuce: { id: 'lettuce', name: '상추', unit: 'g', est: [2500, 200], shelf: 'veg' },
  cucumber: { id: 'cucumber', name: '오이', unit: '개', est: [3000, 3], shelf: 'veg' },
  eggplant: { id: 'eggplant', name: '가지', unit: '개', est: [2500, 2], shelf: 'veg' },
  kingOyster: { id: 'kingOyster', name: '새송이버섯', unit: 'g', est: [2500, 300], shelf: 'veg' },
  shiitake: { id: 'shiitake', name: '표고버섯', unit: 'g', est: [3500, 200], shelf: 'veg' },
  cabbageHead: { id: 'cabbageHead', name: '양배추', unit: 'g', piece: { g: 1500, word: '통' }, est: [3500, 1500], shelf: 'veg' },
  tomato: { id: 'tomato', name: '토마토', unit: 'g', piece: { g: 150, word: '개' }, est: [4900, 600], shelf: 'veg' },
  cherryTomato: { id: 'cherryTomato', name: '방울토마토', unit: 'g', est: [4900, 500], shelf: 'veg' },
  bellPepper: { id: 'bellPepper', name: '피망', unit: '개', est: [2500, 2], shelf: 'veg' },
  sweetPotato: { id: 'sweetPotato', name: '고구마', unit: 'g', est: [4900, 1000], shelf: 'veg' },
  kabocha: { id: 'kabocha', name: '단호박', unit: 'g', piece: { g: 1000, word: '통' }, est: [3500, 1000], shelf: 'veg' },
  perillaLeaf: { id: 'perillaLeaf', name: '깻잎', unit: 'g', est: [1500, 30], shelf: 'veg' },
  jujube: { id: 'jujube', name: '대추', unit: 'g', est: [3000, 100], shelf: 'etc' },
  corn: { id: 'corn', name: '옥수수 통조림', unit: 'g', est: [2000, 340], shelf: 'etc' },
  tofuSoft: { id: 'tofuSoft', name: '순두부', unit: 'g', est: [1500, 350], shelf: 'etc' },
  blackBean: { id: 'blackBean', name: '검은콩(서리태)', unit: 'g', est: [5900, 300], shelf: 'etc' },
  riceCake: { id: 'riceCake', name: '떡볶이 떡', unit: 'g', est: [3000, 500], shelf: 'etc' },
  riceCakeSoup: { id: 'riceCakeSoup', name: '떡국 떡', unit: 'g', est: [4500, 1000], shelf: 'etc' },
  glassNoodle: { id: 'glassNoodle', name: '당면', unit: 'g', est: [3500, 300], shelf: 'etc' },
  somen: { id: 'somen', name: '소면', unit: 'g', est: [2500, 900], shelf: 'etc' },
  udon: { id: 'udon', name: '우동 면', unit: '개', est: [3900, 2], shelf: 'etc' },
  spaghetti: { id: 'spaghetti', name: '스파게티 면', unit: 'g', est: [2900, 500], shelf: 'etc' },
  yubu: { id: 'yubu', name: '초밥용 유부(조미)', unit: 'g', est: [3500, 160], shelf: 'etc' },
  danmuji: { id: 'danmuji', name: '단무지', unit: 'g', est: [1500, 200], shelf: 'etc' },
  tomatoSauce: { id: 'tomatoSauce', name: '토마토 소스', unit: 'g', est: [3900, 600], shelf: 'etc' },
  jjajang: { id: 'jjajang', name: '짜장 가루(순한 맛)', unit: 'g', est: [2500, 100], shelf: 'etc' },
  cream: { id: 'cream', name: '생크림', unit: 'ml', est: [3900, 500], shelf: 'etc' },
  glutinousRice: { id: 'glutinousRice', name: '찹쌀', unit: 'g', est: [5000, 1000], shelf: 'etc' },
  nuts: { id: 'nuts', name: '아몬드 슬라이스', unit: 'g', est: [4900, 100], shelf: 'etc' },
  rawRice: { id: 'rawRice', name: '쌀(리조또·밥 짓기)', unit: 'g' },
  butter: { id: 'butter', name: '버터', unit: 'g', spoon: 13 },
  cheese: { id: 'cheese', name: '슬라이스 치즈', unit: '개' },
  milk: { id: 'milk', name: '우유', unit: 'ml', spoon: 15 },
  ketchup: { id: 'ketchup', name: '케첩', unit: 'g', spoon: 17 },
  oliveOil: { id: 'oliveOil', name: '올리브유', unit: 'ml', spoon: 15 },
  perillaOil: { id: 'perillaOil', name: '들기름', unit: 'ml', spoon: 15 },
  kelp: { id: 'kelp', name: '다시마', unit: 'g' },
  stockAnchovy: { id: 'stockAnchovy', name: '국물용 멸치', unit: 'g' },
  flour: { id: 'flour', name: '밀가루', unit: 'g', spoon: 8 },
  breadcrumb: { id: 'breadcrumb', name: '빵가루', unit: 'g', spoon: 5 },
  pepper: { id: 'pepper', name: '후추', unit: 'g', spoon: 6 },
  lemonJuice: { id: 'lemonJuice', name: '레몬즙', unit: 'ml', spoon: 15 },
  herb: { id: 'herb', name: '말린 허브', unit: 'g', spoon: 2 },
  ssamjang: { id: 'ssamjang', name: '쌈장', unit: 'g', spoon: 18 },
  laver: { id: 'laver', name: '김(자른 것)', unit: 'g' },
  perillaPowder: { id: 'perillaPowder', name: '들깨가루', unit: 'g', spoon: 7 },
  vinegar: { id: 'vinegar', name: '식초', unit: 'ml', spoon: 15 },
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

/** 한 상에서 맡는 자리 — 메인 반찬 / 서브 반찬 / 국 / 한 그릇(카레·볶음밥, 한 상 짜기엔 안 씀) */
export type Role = 'main' | 'sub' | 'soup' | 'one'
/** 메인에 들어가는 고기·생선 */
export type Protein = 'pork' | 'chicken' | 'duck' | 'beef' | 'fish' | 'seafood'
export const PROTEIN_NAME: Record<Protein, string> = {
  pork: '돼지',
  chicken: '닭',
  duck: '오리',
  beef: '소',
  fish: '생선',
  seafood: '해산물',
}
/**
 * 아이도 먹나 — ok: 그대로 / adapt: 맵거나 짠 양념 넣기 전에 덜면 돼요 / adult: 어른 메뉴(매움)
 * 3살 아기가 있는 집은 식단 짜기에서 adult를 빼고 짠다.
 */
export type KidFit = 'ok' | 'adapt' | 'adult'

export interface Recipe {
  slug: string
  name: string
  emoji: string
  /** 사진이 아직 없는 레시피는 그림 글자(emoji)로 보여 준다 */
  photo?: Photo
  role: Role
  /** 메인이면 꼭 — 고기·생선 돌려 쓰기에 쓴다 */
  protein?: Protein
  kid: KidFit
  /** 아기 식판 — 같은 반찬에서 3살 아기 몫 덜어내기·간 조절 한 줄 */
  babyTip?: string
  /** 어른만 매콤하게 — adapt 메뉴에 */
  adultTip?: string
  /** 국물 있는 메인(탕·전골·백숙) — 그날은 국을 따로 안 끓인다 */
  brothy?: boolean
  /** 제철 달(1~12) — 이 달이면 식단 짜기에서 먼저 고른다. 없으면 사계절 */
  months?: number[]
  minutes: number
  /** 한 줄 소개 */
  sub: string
  /** 2인분 기준 재료 양 (재료 단위 그대로) */
  ingredients: [id: string, amount: number][]
  steps: string[]
  /** 1인분 양(g 또는 ml)과 그 음식의 영양 */
  serving: number
  /** 영양 — 식약처 값을 확인한 레시피만. 없으면 영양 칸을 안 보여 준다 */
  per100?: Per100
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

const BASE_RECIPES: Recipe[] = [
  {
    slug: 'kimchi-jjigae',
    role: 'soup', protein: 'pork', kid: 'adult',
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
    role: 'soup', kid: 'ok', babyTip: '된장을 반만 풀었을 때 한 국자 먼저 덜어 주세요.',
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
    role: 'soup', protein: 'beef', kid: 'ok', babyTip: '국간장 넣기 전에 한 국자 덜고, 미역은 잘게 잘라 주세요.',
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
    role: 'main', protein: 'pork', kid: 'adult',
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
    role: 'main', protein: 'beef', kid: 'ok', babyTip: '익힌 고기를 잘게 잘라 주세요. 간장은 2/3만 넣어도 돼요.',
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
    role: 'main', protein: 'chicken', kid: 'adult',
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
    role: 'one', protein: 'pork', kid: 'ok', babyTip: '카레 가루 넣기 전에 건더기를 조금 덜어 우유 한 숟갈과 끓여 주세요.',
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
    role: 'one', kid: 'adult',
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
    role: 'sub', kid: 'ok', babyTip: '한입 크기로 썰어 그대로 올려 주세요.',
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
  {
    slug: 'pork-dubu-jorim',
    role: 'main', protein: 'pork', kid: 'adapt', babyTip: '고춧가루 넣기 전에 고기·두부를 한 국자 덜어 주세요.', adultTip: '아기 몫을 덜고 고춧가루를 넣어요.',
    name: '돼지고기 두부조림',
    emoji: '🍖',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Korean_cuisine-Dubu_jorim-01.jpg/960px-Korean_cuisine-Dubu_jorim-01.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Korean_cuisine-Dubu_jorim-01.jpg',
      license: 'CC BY-SA 2.0',
      author: 'angela n.',
    },
    minutes: 25,
    sub: '고기 조금, 두부 한 모로 든든하게',
    ingredients: [
      ['pork', 150],
      ['tofu', 300],
      ['onion', 100],
      ['greenOnion', 30],
      ['soySauce', 45],
      ['gochugaru', 7],
      ['sugar', 12],
      ['garlic', 10],
      ['oil', 15],
    ],
    steps: [
      '두부는 1cm 두께로 썰어 기름 두른 팬에 앞뒤로 노릇하게 구워요.',
      '간장, 고춧가루, 설탕, 다진 마늘, 물 150ml를 섞어 양념장을 만들어요.',
      '냄비에 돼지고기와 양파를 볶다가 두부를 올리고 양념장을 부어요.',
      '중불에서 10분 졸이고 대파를 올려요.',
    ],
    serving: 150,
    per100: {
      code: 'D611-517030000-0001',
      name: '두부조림_돼지고기',
      kcal: 175,
      carb: 7.09,
      protein: 14.7,
      fat: 9.37,
      sodium: 517,
    },
    withRice: true,
  },
  {
    slug: 'kimchijeon',
    role: 'sub', kid: 'adult',
    name: '김치전',
    emoji: '🥞',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/Korean_pancake-Kimchijeon-01.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Korean_pancake-Kimchijeon-01.jpg',
      license: 'CC BY 2.0',
      author: 'Prince Roy',
    },
    minutes: 20,
    sub: '쉰 김치 처리에 딱',
    ingredients: [
      ['kimchi', 200],
      ['pancakeMix', 120],
      ['onion', 50],
      ['egg', 1],
      ['oil', 30],
    ],
    steps: [
      '김치와 양파를 잘게 썰어요.',
      '부침가루, 물 150ml, 달걀을 섞고 김치와 양파를 넣어요.',
      '기름을 넉넉히 두른 팬에 반죽을 얇게 펴요.',
      '가장자리가 바삭해지면 뒤집어 2분 더 부쳐요.',
    ],
    serving: 150,
    per100: {
      code: 'D109-412000000-0001',
      name: '김치전',
      kcal: 134,
      carb: 19.01,
      protein: 5.05,
      fat: 4.2,
      sodium: 240,
    },
    withRice: false,
  },
  {
    slug: 'dubu-jorim',
    role: 'sub', kid: 'adapt', babyTip: '고춧가루 넣기 전에 두부 두세 조각을 덜어 주세요.', adultTip: '아기 몫을 덜고 고춧가루를 넣어요.',
    name: '두부조림',
    emoji: '🧈',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/8/8c/Dubu-jorim.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Dubu-jorim.jpg',
      license: 'CC BY 4.0',
      author: '세미짱',
    },
    minutes: 20,
    sub: '두부 한 모로 만드는 밥반찬',
    ingredients: [
      ['tofu', 300],
      ['greenOnion', 30],
      ['soySauce', 30],
      ['gochugaru', 7],
      ['sugar', 6],
      ['garlic', 10],
      ['oil', 15],
    ],
    steps: [
      '두부를 1cm 두께로 썰어 소금을 살짝 뿌려요.',
      '기름 두른 팬에 앞뒤로 노릇하게 구워요.',
      '간장, 고춧가루, 설탕, 다진 마늘, 물 100ml를 섞어 붓고 5분 졸여요.',
      '송송 썬 대파를 올려요.',
    ],
    serving: 120,
    per100: {
      code: 'D711-517000000-0001',
      name: '두부조림',
      kcal: 142,
      carb: 10.26,
      protein: 11.5,
      fat: 6.18,
      sodium: 465,
    },
    withRice: true,
  },
  {
    slug: 'dubu-buchim',
    role: 'sub', kid: 'ok', babyTip: '간장 없이 그대로 작게 잘라 주세요.',
    name: '두부부침',
    emoji: '🍳',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Korean_cuisine-Dubu_buchim-01.jpg/960px-Korean_cuisine-Dubu_buchim-01.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Korean_cuisine-Dubu_buchim-01.jpg',
      license: 'CC BY 2.0',
      author: '정희 강',
    },
    minutes: 15,
    sub: '아이 반찬 1순위, 간장만 찍으면 끝',
    ingredients: [
      ['tofu', 300],
      ['egg', 1],
      ['oil', 15],
      ['soySauce', 15],
    ],
    steps: [
      '두부를 1cm 두께로 썰어 키친타월로 물기를 빼요.',
      '소금을 살짝 뿌리고 달걀물을 입혀요.',
      '기름 두른 팬에 앞뒤로 노릇하게 부쳐요.',
      '간장을 곁들여 내요.',
    ],
    serving: 100,
    per100: {
      code: 'D109-419000000-0001',
      name: '두부부침',
      kcal: 140,
      carb: 2.07,
      protein: 10.92,
      fat: 9.77,
      sodium: 429,
    },
    withRice: true,
  },
  {
    slug: 'gyeran-jjim',
    role: 'sub', kid: 'ok', babyTip: '소금을 반만 넣어도 맛있어요.',
    name: '달걀찜',
    emoji: '🥚',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/0/0e/1005_eggjjim.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:1005_eggjjim.jpg',
      license: 'Public domain',
      author: 'Nuyos',
    },
    minutes: 15,
    sub: '전자레인지로도 되는 부드러운 찜',
    ingredients: [
      ['egg', 4],
      ['greenOnion', 10],
      ['salt', 2],
    ],
    steps: [
      '달걀 4개를 풀고 물 200ml, 소금을 넣어 잘 섞어요.',
      '뚝배기에 붓고 약불에서 저어 가며 데워요.',
      '몽글몽글해지면 대파를 올리고 뚜껑을 덮어 3분 더 익혀요.',
      '전자레인지라면 랩을 씌워 3분 돌리고 한 번 저은 뒤 1분 더 돌려요.',
    ],
    serving: 110,
    per100: {
      code: 'D707-317000000-0001',
      name: '달걀찜',
      kcal: 119,
      carb: 1.66,
      protein: 11.1,
      fat: 7.01,
      sodium: 871,
    },
    withRice: true,
  },
  {
    slug: 'gyeran-jangjorim',
    role: 'sub', kid: 'ok', babyTip: '달걀 하나를 반으로 갈라 노른자 쪽부터 주세요.',
    name: '달걀장조림',
    emoji: '🍯',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Gyeran-jang-jorim.jpg/960px-Gyeran-jang-jorim.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Gyeran-jang-jorim.jpg',
      license: 'CC BY 2.0',
      author: 'Chloe Lim',
    },
    minutes: 30,
    sub: '한 번 만들면 사흘 반찬',
    ingredients: [
      ['egg', 6],
      ['soySauce', 90],
      ['sugar', 24],
      ['garlic', 10],
    ],
    steps: [
      '달걀을 찬물에 넣고 끓기 시작하면 10분 삶아 껍질을 까요.',
      '냄비에 간장, 설탕, 다진 마늘, 물 300ml를 넣고 끓여요.',
      '달걀을 넣고 중약불에서 15분, 가끔 굴려 가며 졸여요.',
      '식혀서 냉장고에 두면 사흘 동안 먹어요.',
    ],
    serving: 80,
    per100: {
      code: 'D111-532020000-0001',
      name: '장조림_달걀',
      kcal: 138,
      carb: 8.67,
      protein: 9.85,
      fat: 7.12,
      sodium: 628,
    },
    withRice: true,
  },
  {
    slug: 'gamja-jorim',
    role: 'sub', kid: 'ok', babyTip: '간장을 넣고 졸이기 전에 감자 몇 조각을 덜어 주세요.',
    name: '감자조림',
    emoji: '🥔',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Gamja_jorim_Korean.jpg/960px-Gamja_jorim_Korean.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Gamja_jorim_Korean.jpg',
      license: 'CC BY 4.0',
      author: 'P1898',
    },
    minutes: 25,
    sub: '달짝지근해서 아이가 잘 먹어요',
    ingredients: [
      ['potato', 300],
      ['carrot', 50],
      ['onion', 50],
      ['soySauce', 45],
      ['sugar', 18],
      ['oil', 15],
      ['sesameOil', 5],
    ],
    steps: [
      '감자와 당근을 한입 크기로 썰어 찬물에 5분 담가 전분을 빼요.',
      '기름 두른 냄비에 감자, 당근, 양파를 2분 볶아요.',
      '간장, 설탕, 물 200ml를 넣고 뚜껑을 덮어 12분 졸여요.',
      '국물이 거의 졸면 참기름을 둘러요.',
    ],
    serving: 80,
    per100: {
      code: 'D111-508000000-0001',
      name: '감자조림',
      kcal: 114,
      carb: 18.1,
      protein: 2.4,
      fat: 3.52,
      sodium: 487,
    },
    withRice: true,
  },
  {
    slug: 'kimchi-jjim',
    role: 'main', protein: 'pork', kid: 'adult',
    name: '돼지고기 김치찜',
    emoji: '🥘',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Gimchi-jjim.jpg/960px-Gimchi-jjim.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Gimchi-jjim.jpg',
      license: 'CC0',
      author: 'I. H Cho',
    },
    minutes: 50,
    sub: '푹 익은 김치 한 포기 통째로',
    ingredients: [
      ['kimchi', 400],
      ['pork', 300],
      ['onion', 100],
      ['greenOnion', 30],
      ['gochugaru', 7],
      ['sugar', 6],
      ['garlic', 10],
    ],
    steps: [
      '냄비 바닥에 돼지고기를 깔고 김치를 썰지 않고 그대로 올려요.',
      '양파, 고춧가루, 설탕, 다진 마늘을 얹고 물 500ml를 부어요.',
      '센 불에서 끓으면 뚜껑을 덮고 중약불로 40분 푹 끓여요.',
      '대파를 올리고 김치를 가위로 잘라 내요.',
    ],
    serving: 300,
    per100: {
      code: 'D707-309060000-0001',
      name: '김치찜_돼지고기',
      kcal: 63,
      carb: 4.78,
      protein: 4.8,
      fat: 2.7,
      sodium: 221,
    },
    withRice: true,
  },
  {
    slug: 'dubu-kimchi',
    role: 'main', protein: 'pork', kid: 'adult',
    name: '두부김치',
    emoji: '🍽️',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Dubu-kimchi.jpg/960px-Dubu-kimchi.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Dubu-kimchi.jpg',
      license: 'CC BY 2.0',
      author: 'Chloe Lim',
    },
    minutes: 20,
    sub: '볶은 김치에 따뜻한 두부',
    ingredients: [
      ['tofu', 300],
      ['kimchi', 200],
      ['pork', 100],
      ['onion', 50],
      ['greenOnion', 20],
      ['gochugaru', 7],
      ['sugar', 6],
      ['oil', 15],
      ['sesameOil', 5],
    ],
    steps: [
      '두부는 끓는 물에 3분 데쳐 도톰하게 썰어요.',
      '기름 두른 팬에 돼지고기를 볶다가 김치와 양파를 넣어요.',
      '고춧가루, 설탕을 넣고 5분 더 볶은 뒤 참기름과 대파를 넣어요.',
      '접시에 두부를 둘러 담고 가운데에 볶은 김치를 올려요.',
    ],
    serving: 150,
    per100: {
      code: 'D710-466000000-0001',
      name: '두부김치',
      kcal: 108,
      carb: 5.11,
      protein: 7.8,
      fat: 6.13,
      sodium: 512,
    },
    withRice: true,
  },
  {
    slug: 'gamja-jeon',
    role: 'sub', kid: 'ok', babyTip: '소금을 빼고 아기 몫부터 작게 부쳐 주세요.',
    name: '감자전',
    emoji: '🥔',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/6/6a/Gamja-jeon_1.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Gamja-jeon_1.jpg',
      license: 'CC BY 4.0',
      author: '향긋한 커피매니아',
    },
    minutes: 25,
    sub: '감자만 갈면 되는 쫀득한 전',
    ingredients: [
      ['potato', 400],
      ['onion', 50],
      ['salt', 2],
      ['oil', 30],
    ],
    steps: [
      '감자와 양파를 강판에 갈아 체에 받쳐 물기를 빼요.',
      '받친 물을 5분 두면 바닥에 전분이 가라앉아요. 물만 버리고 전분은 반죽에 다시 섞어요.',
      '소금으로 간하고, 기름 넉넉히 두른 팬에 한 숟가락씩 얇게 펴요.',
      '가장자리가 노릇해지면 뒤집어 2분 더 부쳐요.',
    ],
    serving: 150,
    per100: {
      code: 'D109-408000000-0001',
      name: '감자전',
      kcal: 133,
      carb: 16.79,
      protein: 1.72,
      fat: 6.54,
      sodium: 293,
    },
    withRice: false,
  },
  {
    slug: 'ganjang-dwaeji-bulgogi',
    role: 'main', protein: 'pork', kid: 'ok', babyTip: '간장 양념 넣기 전에 고기 80g을 덜어 따로 볶고 잘게 잘라 주세요.',
    name: '간장 돼지불고기',
    emoji: '🍖',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Dwaeji-bulgogi_2.jpg/960px-Dwaeji-bulgogi_2.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Dwaeji-bulgogi_2.jpg',
      license: 'CC BY 2.0',
      author: 'chomjong',
    },
    minutes: 25,
    sub: '안 매운 돼지고기 반찬, 양념은 아기가 넣어요',
    ingredients: [
      ['pork', 300],
      ['onion', 100],
      ['enoki', 150],
      ['greenOnion', 30],
      ['soySauce', 45],
      ['sugar', 18],
      ['garlic', 10],
      ['sesameOil', 10],
    ],
    steps: [
      '간장, 설탕, 다진 마늘, 참기름을 섞어 양념을 만들어요.',
      '돼지고기에 양념을 버무려 15분 둬요.',
      '팬에 고기를 펼쳐 중불에서 익혀요.',
      '양파, 팽이버섯을 넣고 센 불에 3분, 대파를 넣고 1분 더 볶아요.',
    ],
    serving: 200,
    per100: {
      code: 'D708-375010000-0001',
      name: '돼지불고기_간장',
      kcal: 85,
      carb: 4.3,
      protein: 8.75,
      fat: 3.5,
      sodium: 218,
    },
    withRice: true,
  },
  {
    slug: 'dubu-doenjangguk',
    role: 'soup', kid: 'ok', babyTip: '된장을 반만 풀었을 때 두부와 국물을 덜어 주세요.',
    name: '두부 된장국',
    emoji: '🍵',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Doenjang-guk.jpg/960px-Doenjang-guk.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Doenjang-guk.jpg',
      license: 'CC0',
      author: 'Ji-yeon Yun',
    },
    minutes: 15,
    sub: '찌개보다 묽고 순한 아침 국',
    ingredients: [
      ['tofu', 150],
      ['onion', 50],
      ['greenOnion', 20],
      ['doenjang', 27],
      ['garlic', 5],
    ],
    steps: [
      '냄비에 물 700ml를 붓고 된장을 풀어요.',
      '끓으면 양파와 다진 마늘을 넣고 5분 끓여요.',
      '깍둑 썬 두부를 넣고 3분 더 끓여요.',
      '대파를 넣고 불을 꺼요.',
    ],
    serving: 300,
    per100: {
      code: 'D705-279000000-0001',
      name: '두부 된장국',
      kcal: 26,
      carb: 2.12,
      protein: 2.3,
      fat: 0.99,
      sodium: 245,
    },
    withRice: true,
  },
  {
    slug: 'gyeranguk',
    role: 'soup', kid: 'ok', babyTip: '국간장·소금 넣기 전에 한 국자 덜어 주세요.',
    name: '달걀국',
    emoji: '🥣',
    photo: {
      src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Egg_Soup-Gyeranguk-_%286084411125%29.jpg/960px-Egg_Soup-Gyeranguk-_%286084411125%29.jpg',
      page: 'https://commons.wikimedia.org/wiki/File:Egg_Soup-Gyeranguk-_(6084411125).jpg',
      license: 'CC BY 2.0',
      author: 'Chloe Lim',
    },
    minutes: 10,
    sub: '달걀 세 개로 10분 만에',
    ingredients: [
      ['egg', 3],
      ['greenOnion', 30],
      ['soupSoy', 15],
      ['salt', 2],
    ],
    steps: [
      '냄비에 물 600ml를 끓이고 국간장, 소금으로 간해요.',
      '달걀을 잘 풀어 둬요.',
      '끓는 물에 달걀물을 둥글게 돌려 붓고 30초 동안 젓지 않아요.',
      '대파를 넣고 한 번 저은 뒤 불을 꺼요.',
    ],
    serving: 300,
    per100: {
      code: 'D605-210000000-0001',
      name: '달걀국',
      kcal: 22,
      carb: 1.12,
      protein: 2.07,
      fat: 0.98,
      sodium: 205,
    },
    withRice: true,
  },
]

/** 2026-11-26 아이도 먹는 레시피 22개를 더했다 (recipesMore.ts) */
/** 2026-11-26 피클 100선 중 겹치지 않는 77가지를 양·역할까지 다시 써서 더했다 (recipesP1~P4.ts) */
export const RECIPES: Recipe[] = [
  ...BASE_RECIPES,
  ...MORE_RECIPES,
  ...P1_RECIPES,
  ...P2_RECIPES,
  ...P3_RECIPES,
  ...P4_RECIPES,
]
Object.assign(INGREDIENTS, MORE_INGREDIENTS, P1_INGREDIENTS, P2_INGREDIENTS, P3_INGREDIENTS, P4_INGREDIENTS)

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
export function mealNutrition(r: Recipe): Nutrition | null {
  if (!r.per100) return null
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
  if (id === 'rice') return `${pieces(amount / RICE_BOWL.rawG, '공기')} (쌀 ${tidy(amount)}g)`
  if (ing.spoon) {
    const sp = Math.round((amount / ing.spoon) * 2) / 2
    return sp >= 0.5 ? `${trim(sp)}큰술` : '약간'
  }
  // 한 개·한 모·한 대로 세는 재료는 g 없이 "두부 반모", "대파 1/2대"처럼 (11-26 결영)
  if (ing.piece) return pieces(ing.unit === '개' ? amount : amount / ing.piece.g, ing.piece.word)
  // 달걀처럼 개로만 세는 것 — 1개가 넘으면 반올림해 딱 떨어지게
  if (ing.unit === '개') return amount < 1 ? pieces(amount, '개') : `${Math.max(1, Math.round(amount))}개`
  return `${tidy(amount)}${ing.unit}`
}

/** 281g → 280g, 37g → 40g, 12g → 10g — 저울 없이도 맞출 만하게 */
function tidy(x: number): number {
  if (x < 20) return Math.max(5, Math.round(x / 5) * 5)
  return Math.round(x / 10) * 10
}

/** 0.5 → 반모 · 1/2대, 1.5 → 1모 반, 0.25 → 1/4개 */
function pieces(x: number, word: string): string {
  const q = Math.max(0.25, Math.round(x * 4) / 4)
  const whole = Math.floor(q)
  const rest = q - whole
  if (rest === 0.5) {
    if (!whole) return word === '대' ? `1/2${word}` : `반${word}`
    return `${whole}${word} 반`
  }
  return `${fraction(q)}${word}`
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

// ── 재료로 고르고, 담고, 장보기 (2026-11-01) ──

/** "집에 뭐 있어요?"에 보여 주는 재료 — 싸고 집에 자주 있는 것부터 */
export const MAIN_INGREDIENTS = ['pork', 'kimchi', 'tofu', 'egg', 'potato'] as const

/** 기본 양념과 밥 — 집에 있다고 보고 장보기 목록에서 뺀다 ("양념도 사야 해요"를 켜면 넣는다) */
export const PANTRY = new Set([
  'rice',
  'soySauce',
  'soupSoy',
  'sugar',
  'garlic',
  'gochugaru',
  'gochujang',
  'doenjang',
  'sesameOil',
  'oil',
  'salt',
  // 2026-11-26 — 올리고당·통깨·전분은 한 번 사면 오래 쓰는 양념
  'oligo',
  'sesame',
  'starch',
  // 피클 100선(2026-11-26) — 버터·우유·치즈처럼 아이 있는 집에 늘 있는 것, 쌀
  'butter',
  'cheese',
  'milk',
  'ketchup',
  'oliveOil',
  'perillaOil',
  'kelp',
  'stockAnchovy',
  'flour',
  'breadcrumb',
  'pepper',
  'lemonJuice',
  'herb',
  'ssamjang',
  'laver',
  'perillaPowder',
  'vinegar',
  'rawRice',
])

/** 고른 재료를 쓰는 레시피 — 고른 재료를 많이 쓰는 것부터. 아무것도 안 고르면 전부 */
export function recipesWith(owned: string[]): Recipe[] {
  if (!owned.length) return RECIPES
  const uses = (r: Recipe) => owned.filter((id) => r.ingredients.some(([x]) => x === id)).length
  return RECIPES.filter((r) => uses(r) > 0).sort((a, b) => uses(b) - uses(a))
}

/** 쿠팡에서 고른 한 봉지 — 값과 그 봉지가 몇 g(ml·개)인지 */
export interface Pack {
  price: number
  units: number
  url: string | null
}

export interface ShoppingItem {
  id: string
  /** 담은 레시피들에 드는 양 합계 */
  need: number
  /** 몇 봉지 사야 하나 */
  packs: number
  cost: number | null
  url: string | null
}

export interface ShoppingList {
  toBuy: ShoppingItem[]
  /** 집에 있다고 고른 재료 + (양념 빼기면) 기본 양념 */
  have: string[]
  /** 살 것 합계 — 값이 하나라도 없으면 null */
  total: number | null
}

/** 담은 레시피의 재료를 합쳐, 집에 있는 것은 빼고 봉지 단위로 */
export function shoppingList(
  recipes: Recipe[],
  people: number,
  owned: string[],
  includePantry: boolean,
  packs: Record<string, Pack>,
): ShoppingList {
  const need = new Map<string, number>()
  for (const r of recipes) {
    for (const [id, amount] of ingredientsFor(r, people)) need.set(id, (need.get(id) ?? 0) + amount)
  }
  const toBuy: ShoppingItem[] = []
  const have: string[] = []
  let total: number | null = 0
  for (const [id, amount] of need) {
    if (owned.includes(id) || (!includePantry && PANTRY.has(id))) {
      have.push(id)
      continue
    }
    const pack = packs[id]
    const n = pack ? Math.max(1, Math.ceil(amount / pack.units - 1e-9)) : 1
    const cost = pack ? n * pack.price : null
    if (cost === null) total = null
    else if (total !== null) total += cost
    toBuy.push({ id, need: amount, packs: n, cost, url: pack?.url ?? null })
  }
  return { toBuy, have, total }
}
