import { describe, expect, it } from 'vitest'
import {
  INGREDIENTS,
  RECIPES,
  amountText,
  ingredientsFor,
  mealCost,
  mealNutrition,
  recipeBySlug,
} from './recipes'

describe('집밥 레시피 (2026-11-01)', () => {
  it('재료는 모두 재료 목록에 있고, 주소는 겹치지 않는다', () => {
    for (const r of RECIPES) for (const [id] of r.ingredients) expect(INGREDIENTS[id]).toBeDefined()
    expect(new Set(RECIPES.map((r) => r.slug)).size).toBe(RECIPES.length)
  })

  it('김치찌개 한 끼 — 찌개 300ml(105kcal, 나트륨 792mg) + 밥 한 공기(349kcal)', () => {
    const n = mealNutrition(recipeBySlug('kimchi-jjigae')!)
    expect(Math.round(n.kcal)).toBe(105 + 349)
    expect(Math.round(n.sodium)).toBe(792)
  })

  it('카레라이스는 밥이 들어 있어 밥을 따로 더하지 않는다', () => {
    const r = recipeBySlug('curry')!
    expect(Math.round(mealNutrition(r).kcal)).toBe(500)
    expect(ingredientsFor(r, 2).filter(([id]) => id === 'rice')).toHaveLength(1)
  })

  it('4인분은 2인분 재료의 두 배, 밥은 1인 90g씩', () => {
    const r = recipeBySlug('kimchi-jjigae')!
    const four = Object.fromEntries(ingredientsFor(r, 4))
    expect(four.kimchi).toBe(400)
    expect(four.rice).toBe(360)
  })

  it('쓴 만큼만 계산 — 값이 하나라도 없으면 합계를 내지 않는다', () => {
    const r = recipeBySlug('gyeran-mari')!
    const all = { egg: 300, greenOnion: 5, carrot: 3, oil: 5, rice: 3 }
    // 달걀 4개 1,200 + 대파 100 + 당근 90 + 기름 50 + 쌀 180g 540 = 1,980
    expect(mealCost(r, 2, all)).toEqual({ total: 1980, perPerson: 990, missing: [] })
    const { egg: _egg, ...noEgg } = all
    expect(mealCost(r, 2, noEgg).total).toBeNull()
    expect(mealCost(r, 2, noEgg).missing).toEqual(['egg'])
  })

  it('양 읽기 — 양념은 큰술, 채소는 개, 밥은 공기', () => {
    expect(amountText('gochujang', 36)).toBe('2큰술')
    expect(amountText('tofu', 150)).toBe('150g (1/2모)')
    expect(amountText('zucchini', 0.5)).toBe('1/2개')
    expect(amountText('egg', 4)).toBe('4개')
    expect(amountText('rice', 180)).toBe('2공기 (쌀 180g)')
  })
})
