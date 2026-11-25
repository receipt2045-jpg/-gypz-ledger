import { BASE_SERVINGS, INGREDIENTS, RICE_BOWL, recipeBySlug, type Recipe } from './recipes'

/**
 * 재료로 어림한 영양 (2026-11-26, 결영: "영양정보도, 특히 단백질").
 * 식약처 음식 값(per100)이 있는 레시피는 22가지뿐이라, 121가지 모두에 쓰려고 재료마다 흔한 값을 넣었다.
 * [열량 kcal, 단백질 g] — unit이 g·ml이면 100g(ml)당, '개'면 한 개(먹는 부분)당.
 * 우려내고 건지는 국물용 멸치·다시마는 0으로 센다. 화면에는 「약」을 붙인다.
 */
export const ING_NUT: Record<string, [kcal: number, protein: number]> = {
  rice: [360, 6.5], rawRice: [360, 6.5], glutinousRice: [360, 7],
  kimchi: [33, 2], pork: [180, 19], tofu: [84, 9], greenOnion: [27, 1.7], onion: [36, 1],
  zucchini: [60, 3.6], potato: [66, 2.5], carrot: [34, 1], doenjang: [170, 12], seaweed: [150, 20],
  beefSoup: [190, 20], beefBulgogi: [200, 19], chicken: [180, 18], curry: [450, 8], egg: [75, 6.5],
  gochujang: [230, 5], gochugaru: [300, 13], soySauce: [60, 7], soupSoy: [50, 6], sugar: [387, 0],
  garlic: [120, 6], sesameOil: [880, 0], oil: [880, 0], pancakeMix: [360, 8], salt: [0, 0],
  duck: [300, 16], chickenThigh: [160, 18], porkMince: [220, 18], porkSuyuk: [200, 19],
  mackerel: [200, 20], samchi: [130, 20], salmon: [180, 20], oyster: [70, 10], enoki: [30, 2.5],
  mushroom: [25, 3], mu: [18, 0.7], spinach: [25, 3], beanSprout: [35, 4], broccoli: [30, 3.5],
  cabbage: [13, 1], eomuk: [150, 9], anchovy: [260, 50], oligo: [230, 0], sesame: [600, 20], starch: [350, 0],
  porkNeck: [230, 17], porkRib: [140, 11], porkTenderloin: [115, 22], porkLoin: [150, 22],
  porkBoneless: [200, 18], beefRib: [200, 11], beefRound: [140, 21], beefTenderloin: [180, 21],
  beefMince: [220, 19], beefShank: [150, 21], chickenLeg: [130, 13], chickenWhole: [140, 14],
  chickenBreast: [110, 23], chickenMince: [160, 18], smokedDuck: [280, 17],
  hairtail: [150, 18], cod: [70, 17], shrimp: [90, 19], croaker: [70, 11], flounder: [110, 22],
  crab: [80, 16], squid: [210, 45], abalone: [50, 9], clam: [20, 3], pollack: [80, 17],
  driedPollack: [340, 75], mungSprout: [20, 3], lettuce: [15, 1.3], cucumber: [26, 2],
  eggplant: [30, 1.5], kingOyster: [35, 3], shiitake: [30, 2.5], cabbageHead: [25, 1.5],
  tomato: [18, 1], cherryTomato: [25, 1], bellPepper: [20, 1], sweetPotato: [130, 1.5],
  kabocha: [60, 1.5], perillaLeaf: [40, 4], jujube: [280, 4], corn: [80, 2.5], tofuSoft: [50, 5],
  blackBean: [400, 36], riceCake: [230, 4], riceCakeSoup: [230, 4], glassNoodle: [350, 0.2],
  somen: [350, 9], udon: [280, 7], spaghetti: [370, 13], yubu: [250, 12], danmuji: [25, 0.5],
  tomatoSauce: [60, 2], jjajang: [400, 8], cream: [330, 2], nuts: [580, 21],
  butter: [740, 0.5], cheese: [55, 3.5], milk: [65, 3.2], ketchup: [110, 1.5], oliveOil: [880, 0],
  perillaOil: [880, 0], kelp: [0, 0], stockAnchovy: [0, 0], flour: [360, 10], breadcrumb: [400, 12],
  pepper: [0, 0], lemonJuice: [25, 0], herb: [0, 0], ssamjang: [200, 9], laver: [300, 35],
  perillaPowder: [500, 25], vinegar: [0, 0],
}

export interface KcalProtein {
  kcal: number
  protein: number
}

const per = (id: string, amount: number): KcalProtein => {
  const n = ING_NUT[id]
  if (!n) return { kcal: 0, protein: 0 }
  const k = INGREDIENTS[id]?.unit === '개' ? amount : amount / 100
  return { kcal: n[0] * k, protein: n[1] * k }
}

/** 한 사람 몫(어른 1인분) — 레시피 재료는 2인분이라 반으로. 밥은 따로 */
export function dishPerPerson(r: Recipe): KcalProtein {
  let kcal = 0
  let protein = 0
  for (const [id, a] of r.ingredients) {
    const v = per(id, a / BASE_SERVINGS)
    kcal += v.kcal
    protein += v.protein
  }
  return { kcal, protein }
}

/** 한 상(메인+서브+국) 어른 1인분 — 밥 한 공기 포함(한 그릇 요리가 아니면) */
export function mealPerAdult(slugs: string[]): KcalProtein {
  const rs = slugs.map(recipeBySlug).filter((r): r is Recipe => !!r)
  const out = rs.reduce(
    (s, r) => {
      const d = dishPerPerson(r)
      return { kcal: s.kcal + d.kcal, protein: s.protein + d.protein }
    },
    { kcal: 0, protein: 0 },
  )
  if (rs.some((r) => r.withRice)) {
    const rice = per('rice', RICE_BOWL.rawG)
    out.kcal += rice.kcal
    out.protein += rice.protein
  }
  return out
}

/**
 * 하루 단백질 권장섭취량 (한국인 영양소 섭취기준 2020) — 성인 여 50~55g·남 65g, 3~5세 25g.
 * 화면에선 아기 몫을 어른의 반으로 보고, 한 끼에 하루 권장량의 몇 %인지 보여 준다.
 */
export const PROTEIN_DAILY = { adultF: 50, adultM: 65, kid3to5: 25 }
