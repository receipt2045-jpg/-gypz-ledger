import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  allowed,
  budgetPreview,
  cleanSettings,
  makeWeekPlan,
  mondayKey,
  packsWithEstimate,
  planStillValid,
  swapDay,
  tripDays,
  tripShopping,
  type MealSettings,
} from './mealPlan'
import { INGREDIENTS, PANTRY, RECIPES, recipeBySlug } from './recipes'
import { REELS } from './reels'
import { SEASON } from './season'

const S = DEFAULT_SETTINGS
const { packs } = packsWithEstimate({})

describe('집밥 플래너 (2026-11-26)', () => {
  it('레시피 44가지 — 재료는 다 목록에 있고, 사야 하는 재료는 모두 예상값이 있다', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(44)
    expect(new Set(RECIPES.map((r) => r.slug)).size).toBe(RECIPES.length)
    for (const r of RECIPES)
      for (const [id] of r.ingredients) {
        expect(INGREDIENTS[id], `${r.slug}:${id}`).toBeDefined()
        if (!PANTRY.has(id)) expect(INGREDIENTS[id].est, `${r.slug}:${id} 예상값`).toBeDefined()
      }
  })

  it('메인은 모두 고기·생선이 정해져 있고, 아기 팁이 있다(어른 메뉴 빼고)', () => {
    for (const r of RECIPES) {
      if (r.role === 'main') expect(r.protein, r.slug).toBeDefined()
      if (r.kid !== 'adult') expect(r.babyTip, r.slug).toBeTruthy()
    }
  })

  it('배달 일요일 + 3일 간격 → 월화수 / 목금토', () => {
    expect(tripDays(S)).toEqual([
      [0, 1, 2],
      [3, 4, 5],
    ])
    expect(tripDays({ ...S, interval: 7, deliveryDays: [] })).toEqual([[0, 1, 2, 3, 4, 5, 6]])
    expect(tripDays({ ...S, interval: 2, deliveryDays: [4] })).toEqual([[0, 1], [2, 3], [5, 6]])
  })

  it('한 상은 메인·서브·국, 일주일 안에서 같은 반찬이 겹치지 않고, 배달 날은 비운다', () => {
    const plan = makeWeekPlan(S, 11, '2026-11-23#0')
    expect(plan[6]).toBeNull()
    const all = plan.flatMap((m) => (m ? [m.main, m.sub, m.soup] : []))
    expect(all).toHaveLength(18)
    expect(new Set(all).size).toBe(18)
    for (const m of plan) {
      if (!m) continue
      expect(recipeBySlug(m.main)!.role).toBe('main')
      expect(recipeBySlug(m.sub)!.role).toBe('sub')
      expect(recipeBySlug(m.soup)!.role).toBe('soup')
    }
    expect(planStillValid(plan, S)).toBe(true)
  })

  it('아이가 있으면 매운 어른 메뉴는 안 나온다', () => {
    const plan = makeWeekPlan(S, 11, 'x#1')
    for (const m of plan) if (m) for (const x of [m.main, m.sub, m.soup]) expect(recipeBySlug(x)!.kid).not.toBe('adult')
  })

  it('어제와 같은 고기를 연달아 쓰지 않는다 (같은 장보기 안)', () => {
    const plan = makeWeekPlan(S, 11, '2026-11-23#0')
    for (const t of tripDays(S))
      for (let i = 1; i < t.length; i++)
        expect(recipeBySlug(plan[t[i]]!.main)!.protein).not.toBe(recipeBySlug(plan[t[i - 1]]!.main)!.protein)
  })

  it('장보기 한 번은 5만원 안 (예상값 기준)', () => {
    for (const seed of ['a#0', 'b#1', 'c#2', '2026-11-23#0']) {
      const plan = makeWeekPlan(S, 11, seed)
      for (const t of tripDays(S)) {
        const total = tripShopping(t.map((d) => plan[d]), S, packs).total
        expect(total, seed).not.toBeNull()
        expect(total!, seed).toBeLessThanOrEqual(S.tripBudget)
      }
    }
  })

  it('못 먹는 재료와 고르지 않은 고기는 빠진다', () => {
    const s: MealSettings = { ...S, exclude: ['달걀', '굴'], proteins: ['pork', 'chicken'] }
    const plan = makeWeekPlan(s, 11, 'z#0')
    for (const m of plan) {
      if (!m) continue
      for (const x of [m.main, m.sub, m.soup]) {
        const r = recipeBySlug(x)!
        expect(allowed(r, s)).toBe(true)
        expect(r.ingredients.some(([id]) => ['egg', 'oyster'].includes(id))).toBe(false)
      }
      expect(['pork', 'chicken']).toContain(recipeBySlug(m.main)!.protein)
    }
  })

  it('이 날만 바꾸기 — 그 날만 바뀌고 다른 날은 그대로', () => {
    const plan = makeWeekPlan(S, 11, 'w#0')
    const next = swapDay(plan, 1, S, 11, 'w#1')
    expect(next[0]).toEqual(plan[0])
    expect(next[2]).toEqual(plan[2])
    expect(next[1]).not.toEqual(plan[1])
    const all = next.flatMap((m) => (m ? [m.main, m.sub, m.soup] : []))
    expect(new Set(all).size).toBe(all.length)
  })

  it('11월이면 제철(굴·무·시금치…) 반찬이 들어간다', () => {
    const plan = makeWeekPlan(S, 11, '2026-11-23#0')
    const seasonal = plan.flatMap((m) => (m ? [m.main, m.sub, m.soup] : [])).filter((x) => recipeBySlug(x)!.months?.includes(11))
    expect(seasonal.length).toBeGreaterThan(0)
  })

  it('기준 미리보기 — 주 2번 × 5만 = 10만, 한 달 약 43만 + 배달 13만', () => {
    expect(budgetPreview(S)).toEqual({ trips: 2, shop: 100_000, fits: true, monthHome: 430_000, monthDelivery: 130_000, month: 560_000 })
    expect(budgetPreview({ ...S, tripBudget: 60_000 }).fits).toBe(false)
  })

  it('저장된 기준이 이상하면 기본값으로', () => {
    expect(cleanSettings(null)).toEqual(S)
    expect(cleanSettings({ adults: 'x', interval: 5, deliveryDays: [9, 6, 6], proteins: [] })).toMatchObject({
      adults: 2,
      interval: 3,
      deliveryDays: [6],
      proteins: S.proteins,
    })
  })

  it('주는 월요일부터', () => {
    expect(mondayKey(new Date(2026, 10, 26))).toBe('2026-11-23')
    expect(mondayKey(new Date(2026, 10, 29))).toBe('2026-11-23')
    expect(mondayKey(new Date(2026, 10, 30))).toBe('2026-11-30')
  })

  it('릴스 1편 레시피가 다 있고, 제철 재료 id도 다 있다', () => {
    for (const ep of REELS) for (const x of Object.values(ep.meal)) expect(recipeBySlug(x), x).toBeDefined()
    for (const list of Object.values(SEASON)) for (const i of list) if (i.ing) expect(INGREDIENTS[i.ing], i.name).toBeDefined()
  })
})
