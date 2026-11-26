import {
  INGREDIENTS,
  PANTRY,
  RECIPES,
  recipeBySlug,
  shoppingList,
  type Pack,
  type Protein,
  type Recipe,
  type Role,
  type ShoppingList,
} from './recipes'

/**
 * 결영이네 집밥 플래너 (2026-11-26).
 * 우리집 식비 기준(한 주·한 번 장볼 때·간격·외식 날·고기·못 먹는 재료)으로
 * 일주일 식단을 짜고, 장보기 한 번 = 사흘 한 상(메인 1 + 서브 1 + 국 1)으로 묶는다.
 * 반찬은 그날 다 먹는다 — 양은 딱 식구 수만큼, 쌓아 두고 돌려 먹지 않는다.
 */

export interface MealSettings {
  /** 우리집 이름 — 「민지네」처럼. 비우면 「우리집」 (식단 짜기엔 안 씀) */
  name: string
  /** 어른 몇 명 */
  adults: number
  /** 아이 몇 명 — 아이 1명은 어른 반 인분으로 셈하고, 있으면 매운 메뉴를 뺀다 */
  kids: number
  /** 한 주 집밥(장보기) 돈 — 외식은 따로 */
  weekBudget: number
  /** 한 번 장볼 때 넘지 않을 돈 */
  tripBudget: number
  /** 며칠에 한 번 장 보나 — 7이면 일주일에 한 번 */
  interval: 2 | 3 | 7
  /** 외식하는 날 — 0=월 … 6=일 */
  deliveryDays: number[]
  /** 외식 한 번 얼마 */
  deliveryCost: number
  /** 메인에 쓸 고기·생선 */
  proteins: Protein[]
  /** 못 먹는 재료 — 재료 이름에 이 말이 들어 있으면 뺀다 ("고추"면 고추장·고춧가루까지) */
  exclude: string[]
}

export const DEFAULT_SETTINGS: MealSettings = {
  name: '',
  adults: 2,
  kids: 1,
  weekBudget: 100_000,
  tripBudget: 50_000,
  interval: 3,
  deliveryDays: [6],
  deliveryCost: 30_000,
  proteins: ['pork', 'chicken', 'duck', 'beef', 'fish', 'seafood'],
  exclude: [],
}

export const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'] as const
/** 못 먹는 재료 빨리 고르기 — 알레르기·아이가 싫어하는 것 흔한 순 */
export const EXCLUDE_CHIPS = ['달걀', '우유', '땅콩', '새우', '굴', '고추', '버섯', '두부', '오이']

const PROTEINS: Protein[] = ['pork', 'chicken', 'duck', 'beef', 'fish', 'seafood']
const isNum = (v: unknown, lo: number, hi: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi

/** 폰·서버에서 읽은 값을 믿기 전에 — 이상한 칸은 기본값으로 */
export function cleanSettings(v: unknown): MealSettings {
  const d = DEFAULT_SETTINGS
  if (!v || typeof v !== 'object') return d
  const o = v as Record<string, unknown>
  const days = Array.isArray(o.deliveryDays)
    ? [...new Set(o.deliveryDays.filter((x): x is number => isNum(x, 0, 6) && Number.isInteger(x)))]
    : d.deliveryDays
  const proteins = Array.isArray(o.proteins)
    ? o.proteins.filter((x): x is Protein => PROTEINS.includes(x as Protein))
    : d.proteins
  const exclude = Array.isArray(o.exclude)
    ? o.exclude.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim())
    : d.exclude
  return {
    name: typeof o.name === 'string' ? o.name.trim().slice(0, NAME_MAX) : d.name,
    adults: isNum(o.adults, 1, 6) ? Math.round(o.adults as number) : d.adults,
    kids: isNum(o.kids, 0, 4) ? Math.round(o.kids as number) : d.kids,
    weekBudget: isNum(o.weekBudget, 10_000, 1_000_000) ? (o.weekBudget as number) : d.weekBudget,
    tripBudget: isNum(o.tripBudget, 10_000, 1_000_000) ? (o.tripBudget as number) : d.tripBudget,
    interval: o.interval === 2 || o.interval === 3 || o.interval === 7 ? o.interval : d.interval,
    deliveryDays: days.length < 7 ? days.sort() : d.deliveryDays,
    deliveryCost: isNum(o.deliveryCost, 0, 200_000) ? (o.deliveryCost as number) : d.deliveryCost,
    proteins: proteins.length ? proteins : d.proteins,
    exclude,
  }
}

export const NAME_MAX = 10

/** 화면 맨 위 「○○ 집밥」의 ○○ — 「민지네 집밥」이라고 적어도 집밥이 두 번 붙지 않게 */
export function houseName(s: Pick<MealSettings, 'name'>): string {
  const n = s.name.trim().replace(/\s*집밥$/, '').trim()
  return n || '우리집'
}

/** 레시피 양에 넣는 인원 — 아이는 반 인분 */
export const portionsOf = (s: MealSettings) => s.adults + s.kids * 0.5

/** 이 집이 먹을 수 있는 레시피인가 */
export function allowed(r: Recipe, s: MealSettings): boolean {
  if (r.role === 'one') return false
  if (s.kids > 0 && r.kid === 'adult') return false
  if (r.role === 'main' && (!r.protein || !s.proteins.includes(r.protein))) return false
  return !excludedBy(r, s.exclude)
}

/** 못 먹는 재료에 걸리는 재료 이름 (없으면 null) */
export function excludedBy(r: Recipe, exclude: string[]): string | null {
  for (const [id] of r.ingredients) {
    const name = INGREDIENTS[id]?.name ?? id
    if (exclude.some((w) => name.includes(w))) return name
  }
  return null
}

export const inSeason = (r: Recipe, month: number) => !!r.months?.includes(month)

// ── 장보기 묶음 ──

/** 장보기 한 번이 맡는 요일들 — 외식 날을 빼고 간격만큼씩 묶는다 */
export function tripDays(s: MealSettings): number[][] {
  const cook = [0, 1, 2, 3, 4, 5, 6].filter((d) => !s.deliveryDays.includes(d))
  const size = s.interval === 7 ? 7 : s.interval
  const out: number[][] = []
  for (let i = 0; i < cook.length; i += size) out.push(cook.slice(i, i + size))
  return out
}

/** 한 상 — 국물 있는 메인(brothy)이면 soup은 '' */
export interface Meal {
  main: string
  sub: string
  soup: string
}
/** 요일별 한 상 — 외식 날은 null */
export type WeekPlan = (Meal | null)[]

/** 실제 쿠팡 값(표)이 있으면 그것, 없으면 예상 봉지값 */
export function packsWithEstimate(live: Record<string, Pack>): {
  packs: Record<string, Pack>
  estimated: Set<string>
} {
  const packs: Record<string, Pack> = {}
  const estimated = new Set<string>()
  for (const ing of Object.values(INGREDIENTS)) {
    if (live[ing.id]) packs[ing.id] = live[ing.id]
    else if (ing.est) {
      packs[ing.id] = { price: ing.est[0], units: ing.est[1], url: null }
      estimated.add(ing.id)
    }
  }
  return { packs, estimated }
}

const mealRecipes = (meals: (Meal | null)[]) =>
  meals
    .filter((m): m is Meal => !!m)
    .flatMap((m) => [m.main, m.sub, m.soup])
    .map(recipeBySlug)
    .filter((r): r is Recipe => !!r)

/** 장보기 한 번 목록 — 양념·쌀은 집에 있다고 보고 뺀다 */
export function tripShopping(
  meals: (Meal | null)[],
  s: MealSettings,
  packs: Record<string, Pack>,
): ShoppingList {
  return shoppingList(mealRecipes(meals), portionsOf(s), [], false, packs)
}

// ── 식단 짜기 ──

/** 같은 주·같은 기준이면 같은 식단 — 새로 짜기를 누를 때만 바뀐다 */
function rng(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

const buyIds = (r: Recipe) => r.ingredients.map(([id]) => id).filter((id) => !PANTRY.has(id))

interface PickCtx {
  s: MealSettings
  month: number
  packs: Record<string, Pack>
  /** 이번 주에 이미 나온 레시피 */
  used: Set<string>
  /** 같은 장보기에서 이미 사는 재료 — 겹치면 싸지고 남는 게 없다 */
  basket: Set<string>
  /** 어제 메인 고기 */
  lastProtein?: Protein
  /** 이 장보기에서 이미 메인으로 쓴 고기·생선 재료 — 사흘 내내 고등어만 나오지 않게 */
  mains?: Set<string>
  /** 오늘 한 상에 이미 들어간 재료 — 감자조림 옆에 감자국이 오지 않게 */
  today?: Set<string>
  rand: () => number
}

function score(r: Recipe, c: PickCtx): number {
  // 같은 기준이라도 주마다 다양하게 — 운을 조금 크게
  let v = c.rand() * 1.6
  if (inSeason(r, c.month)) v += 0.7
  if (c.used.has(r.slug)) v -= 3
  if (r.role === 'main' && r.protein && r.protein === c.lastProtein) v -= 1
  const ids = buyIds(r)
  v += 0.25 * ids.filter((id) => c.basket.has(id)).length
  // 같은 날 반찬끼리 재료가 겹치면 덜 고른다 (장보기에선 이득이어도 밥상이 단조롭다)
  if (c.today) v -= 0.9 * ids.filter((id) => c.today!.has(id)).length
  if (r.role === 'main' && c.mains && INGREDIENTS[ids[0]]?.shelf === 'meat' && c.mains.has(ids[0])) v -= 1.2
  // 새로 사야 하는 재료 값이 비쌀수록 덜 고른다
  const extra = ids
    .filter((id) => !c.basket.has(id))
    .reduce((sum, id) => sum + (c.packs[id]?.price ?? 3000), 0)
  v -= (extra / Math.max(c.s.tripBudget, 10_000)) * 4
  return v
}

function pick(role: Role, c: PickCtx, not: string[] = []): Recipe | null {
  const ok = RECIPES.filter((r) => r.role === role && allowed(r, c.s) && !not.includes(r.slug))
  // 이번 주에 나온 반찬은 다시 안 쓴다 — 고를 게 모자랄 때만(못 먹는 재료가 많은 집) 겹친다
  const fresh = ok.filter((r) => !c.used.has(r.slug))
  // 메인은 어제와 다른 고기로 — 다른 고기가 없을 때만 같은 고기
  const rotated =
    role === 'main' && c.lastProtein ? fresh.filter((r) => r.protein !== c.lastProtein) : fresh
  const list = rotated.length ? rotated : fresh.length ? fresh : ok
  if (!list.length) return null
  let best = list[0]
  let bestV = -Infinity
  for (const r of list) {
    const v = score(r, c)
    if (v > bestV) {
      bestV = v
      best = r
    }
  }
  return best
}

function pickMeal(c: PickCtx, not: string[] = []): Meal | null {
  c.today = new Set()
  const main = pick('main', c, not)
  if (main) for (const id of buyIds(main)) c.today.add(id)
  const sub = pick('sub', c, not)
  if (sub) for (const id of buyIds(sub)) c.today.add(id)
  // 탕·전골·백숙처럼 국물 있는 메인이면 그날 국은 따로 안 끓인다
  const soup = main?.brothy ? null : pick('soup', c, not)
  c.today = undefined
  if (!main || !sub || (!soup && !main.brothy)) return null
  for (const r of [main, sub, soup]) {
    if (!r) continue
    c.used.add(r.slug)
    for (const id of buyIds(r)) c.basket.add(id)
  }
  c.mains = c.mains ?? new Set()
  const key = buyIds(main)[0]
  if (key) c.mains.add(key)
  c.lastProtein = main.protein
  return { main: main.slug, sub: sub.slug, soup: soup?.slug ?? '' }
}

/** 장보기 한 번이 예산을 넘으면, 가장 많이 줄이는 반찬 하나씩 바꾼다 */
function fitBudget(plan: WeekPlan, days: number[], s: MealSettings, packs: Record<string, Pack>) {
  const cost = () => tripShopping(days.map((d) => plan[d]), s, packs).total ?? Infinity
  for (let round = 0; round < 12 && cost() > s.tripBudget; round++) {
    const now = cost()
    let best: { d: number; meal: Meal } | null = null
    let bestCost = now
    for (const d of days) {
      const meal = plan[d]
      if (!meal) continue
      const brothy = !!recipeBySlug(meal.main)?.brothy
      for (const role of ['main', 'sub', 'soup'] as const) {
        if (role === 'soup' && !meal.soup) continue
        const taken = new Set(plan.flatMap((m) => (m ? [m.main, m.sub, m.soup] : [])))
        for (const r of RECIPES) {
          if (r.role !== role || !allowed(r, s) || taken.has(r.slug)) continue
          // 국물 메인은 국물 메인끼리만 바꾼다 (국 칸이 비었거나 차 있는 게 그대로)
          if (role === 'main' && !!r.brothy !== brothy) continue
          // 메인을 바꿀 때도 앞뒤 날과 다른 고기로
          if (role === 'main' && [plan[d - 1], plan[d + 1]].some((m) => m && recipeBySlug(m.main)?.protein === r.protein))
            continue
          plan[d] = { ...meal, [role]: r.slug }
          const c = cost()
          if (c < bestCost) {
            bestCost = c
            best = { d, meal: plan[d]! }
          }
        }
        plan[d] = meal
      }
    }
    if (!best) break
    plan[best.d] = best.meal
  }
}

/**
 * 일주일 식단. seed는 '2026-11-23#0'처럼 주 + 새로 짠 횟수.
 * 고기 돌려 쓰기(어제와 다른 고기) · 제철 먼저 · 같은 장보기 안에서 재료 겹치게 · 한 번 장보기 예산 안으로.
 */
export function makeWeekPlan(
  s: MealSettings,
  month: number,
  seed: string,
  live: Record<string, Pack> = {},
): WeekPlan {
  const { packs } = packsWithEstimate(live)
  const trips = tripDays(s)
  const over = (plan: WeekPlan) =>
    trips.reduce((sum, days) => {
      const c = tripShopping(days.map((d) => plan[d]), s, packs).total ?? Infinity
      return sum + Math.max(0, c - s.tripBudget)
    }, 0)
  // 주 전체를 몇 번 짜 보고, 모든 장보기가 예산 안인 첫 식단 — 없으면 덜 넘는 식단
  let best: { plan: WeekPlan; over: number } | null = null
  for (let w = 0; w < 6; w++) {
    const plan = weekOnce(s, month, `${seed}/${w}`, packs, trips)
    const o = over(plan)
    if (!best || o < best.over) best = { plan, over: o }
    if (o === 0) break
  }
  return best!.plan
}

function weekOnce(
  s: MealSettings,
  month: number,
  seed: string,
  packs: Record<string, Pack>,
  trips: number[][],
): WeekPlan {
  const plan: WeekPlan = Array(7).fill(null)
  const used = new Set<string>()
  let lastProtein: Protein | undefined
  trips.forEach((days, t) => {
    // 여러 조합을 짜 보고 예산 안에 드는 첫 조합 — 없으면 가장 싼 조합을 반찬 바꿔 가며 맞춘다
    let best: { meals: (Meal | null)[]; cost: number } | null = null
    for (let k = 0; k < 30; k++) {
      const c: PickCtx = { s, month, packs, used: new Set(used), basket: new Set(), lastProtein, rand: rng(`${seed}/${t}/${k}`) }
      const meals = days.map(() => pickMeal(c))
      const cost = tripShopping(meals, s, packs).total ?? Infinity
      if (!best || cost < best.cost) best = { meals, cost }
      if (cost <= s.tripBudget) break
    }
    days.forEach((d, i) => (plan[d] = best!.meals[i]))
    if (best!.cost > s.tripBudget) fitBudget(plan, days, s, packs)
    // 예산 맞추며 바뀐 반찬까지 '이번 주에 나옴'으로
    for (const d of days) if (plan[d]) for (const x of Object.values(plan[d]!)) used.add(x)
    const last = plan[days[days.length - 1]]
    lastProtein = last ? recipeBySlug(last.main)?.protein : lastProtein
  })
  return plan
}

/** 이 날 메뉴만 바꾸기 — 다른 날은 그대로, 이번 주에 안 나온 것으로 */
export function swapDay(
  plan: WeekPlan,
  day: number,
  s: MealSettings,
  month: number,
  seed: string,
  live: Record<string, Pack> = {},
): WeekPlan {
  const { packs } = packsWithEstimate(live)
  const trip = tripDays(s).find((t) => t.includes(day)) ?? [day]
  const others = plan.filter((m, i): m is Meal => !!m && i !== day)
  const used = new Set(others.flatMap((m) => [m.main, m.sub, m.soup].filter(Boolean)))
  const basket = new Set(
    trip
      .filter((d) => d !== day)
      .flatMap((d) => (plan[d] ? mealRecipes([plan[d]]) : []))
      .flatMap(buyIds),
  )
  const before = plan[day]
  const not = before ? [before.main, before.sub, before.soup].filter(Boolean) : []
  // 몇 번 골라 보고 이 장보기가 예산 안에 드는 첫 한 상 — 없으면 가장 싼 한 상
  let best: { meal: Meal; cost: number } | null = null
  for (let k = 0; k < 20; k++) {
    const c: PickCtx = {
      s,
      month,
      packs,
      used: new Set(used),
      basket: new Set(basket),
      lastProtein: day > 0 ? recipeBySlug(plan[day - 1]?.main ?? '')?.protein : undefined,
      rand: rng(`${seed}/swap${day}/${k}`),
    }
    const meal = pickMeal(c, not)
    if (!meal) break
    const cost = tripShopping(trip.map((d) => (d === day ? meal : plan[d])), s, packs).total ?? Infinity
    if (!best || cost < best.cost) best = { meal, cost }
    if (cost <= s.tripBudget) break
  }
  const next = [...plan]
  next[day] = best?.meal ?? before
  return next
}

/** 주가 시작하는 월요일 'YYYY-MM-DD' */
export function mondayKey(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 기준이 같은지 — 바뀌면 식단을 새로 짠다 */
export const settingsKey = ({ name: _name, ...rest }: MealSettings) => JSON.stringify(rest)

/** 기준 화면 미리보기 — "장보기 주 2번 × 5만원 = 10만원" */
export function budgetPreview(s: MealSettings) {
  const trips = tripDays(s).length
  const shop = trips * s.tripBudget
  const delivery = s.deliveryDays.length * s.deliveryCost
  const perMonth = (n: number) => Math.round((n * 30) / 7 / 10_000) * 10_000
  return {
    trips,
    shop,
    fits: shop <= s.weekBudget,
    monthHome: perMonth(Math.min(shop, s.weekBudget)),
    monthDelivery: perMonth(delivery),
    month: perMonth(Math.min(shop, s.weekBudget)) + perMonth(delivery),
  }
}

/** 식단이 쓰는 레시피 — 이 집에서 못 쓰게 됐으면(기준을 바꿈) 다시 짜야 한다 */
export function planStillValid(plan: WeekPlan, s: MealSettings): boolean {
  const days = new Set(tripDays(s).flat())
  return plan.every((m, d) => {
    if (!days.has(d)) return m === null
    if (!m) return false
    const main = recipeBySlug(m.main)
    if (!m.soup && !main?.brothy) return false
    return [m.main, m.sub, m.soup].filter(Boolean).every((x) => {
      const r = recipeBySlug(x)
      return !!r && allowed(r, s)
    })
  })
}
