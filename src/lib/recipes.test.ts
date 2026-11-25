import { describe, expect, it } from 'vitest'
import {
  INGREDIENTS,
  MAIN_INGREDIENTS,
  RECIPES,
  recipesWith,
  shoppingList,
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
    const n = mealNutrition(recipeBySlug('kimchi-jjigae')!)!
    expect(Math.round(n.kcal)).toBe(105 + 349)
    expect(Math.round(n.sodium)).toBe(792)
  })

  it('카레라이스는 밥이 들어 있어 밥을 따로 더하지 않는다', () => {
    const r = recipeBySlug('curry')!
    expect(Math.round(mealNutrition(r)!.kcal)).toBe(500)
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

  it('돼지고기를 고르면 돼지고기가 들어가는 레시피만', () => {
    const list = recipesWith(['pork'])
    expect(list.length).toBeGreaterThanOrEqual(4)
    for (const r of list) expect(r.ingredients.some(([id]) => id === 'pork')).toBe(true)
  })

  it('재료 다섯 개마다 레시피가 5개 이상', () => {
    for (const id of MAIN_INGREDIENTS) expect(recipesWith([id]).length).toBeGreaterThanOrEqual(5)
  })

  it('장보기 — 담은 레시피 재료를 합치고, 고른 재료·양념은 빼고, 봉지 단위로', () => {
    const picked = ['kimchi-jjigae', 'jeyuk'].map((s) => recipeBySlug(s)!)
    const packs = {
      kimchi: { price: 9000, units: 1000, url: null },
      tofu: { price: 1500, units: 300, url: null },
      onion: { price: 3000, units: 1500, url: null },
      greenOnion: { price: 2500, units: 500, url: null },
    }
    const list = shoppingList(picked, 2, ['pork'], false, packs)
    expect(list.toBuy.map((i) => i.id).sort()).toEqual(['greenOnion', 'kimchi', 'onion', 'tofu'])
    expect(list.have).toContain('pork')
    expect(list.have).toContain('gochujang')
    // 양파 100g + 100g → 1.5kg 한 봉지
    expect(list.toBuy.find((i) => i.id === 'onion')).toMatchObject({
      need: 200,
      packs: 1,
      cost: 3000,
    })
    expect(list.total).toBe(9000 + 1500 + 3000 + 2500)
  })

  it('양념도 사야 하면 목록에 넣고, 값이 없는 재료가 있으면 합계를 내지 않는다', () => {
    const list = shoppingList([recipeBySlug('dubu-buchim')!], 2, [], true, {})
    expect(list.toBuy.map((i) => i.id)).toContain('soySauce')
    expect(list.total).toBeNull()
  })

  it('양 읽기 — 양념은 큰술, 채소는 개, 밥은 공기', () => {
    expect(amountText('gochujang', 36)).toBe('2큰술')
    expect(amountText('tofu', 150)).toBe('150g (1/2모)')
    expect(amountText('zucchini', 0.5)).toBe('1/2개')
    expect(amountText('egg', 4)).toBe('4개')
    expect(amountText('rice', 180)).toBe('2공기 (쌀 180g)')
  })
})
