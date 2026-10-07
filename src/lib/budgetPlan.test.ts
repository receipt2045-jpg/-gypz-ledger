import { describe, expect, it } from 'vitest'
import {
  cellSum,
  leftOf,
  mergeBudget,
  sharedNeed,
  splitContributions,
  totalLeft,
} from './budgetPlan'
import type { BudgetItem } from '../types'

const mk = (
  id: string,
  group: BudgetItem['group'],
  category: string,
  member: 1 | 2,
  planned: number,
  shared = false,
): BudgetItem => ({
  id,
  group,
  category,
  member,
  planned,
  actual: 0,
  ...(shared ? { shared } : {}),
})

// 목업 숫자 — 남편 400만 · 아내 350만, 공동통장 200 + 150
const ITEMS: BudgetItem[] = [
  mk('i1', 'income', '주수입', 1, 4_000_000),
  mk('i2', 'income', '주수입', 2, 3_500_000),
  mk('s1', 'saving', '적금', 1, 700_000),
  mk('v1', 'investment', '주식', 1, 500_000),
  mk('s2', 'saving', '적금', 2, 1_000_000),
  mk('f1', 'fixed', '통신', 1, 70_000),
  mk('f2', 'fixed', '통신', 2, 70_000),
  mk('fj', 'fixed', '주거', 1, 1_870_000, true),
  mk('vj', 'variable', '식비', 2, 1_150_000, true),
  mk('p1', 'fixed', '용돈', 1, 500_000),
  mk('p2', 'fixed', '용돈', 2, 500_000),
]
const CON = { 1: 2_000_000, 2: 1_500_000 }

describe('예산 표 계산', () => {
  it('저축·투자 줄은 저축과 투자를 합친다', () => {
    expect(cellSum(ITEMS, 'save', 1)).toBe(1_200_000)
  })

  it('공동 칸은 shared 항목만 — 누가 적었는지와 상관없이', () => {
    expect(cellSum(ITEMS, 'fixed', 'j')).toBe(1_870_000)
    expect(cellSum(ITEMS, 'variable', 'j')).toBe(1_150_000)
    expect(cellSum(ITEMS, 'fixed', 1)).toBe(570_000)
  })

  it('칸마다 남는 돈: 사람은 공동통장으로 보낸 돈까지 빼고, 공동은 모인 돈에서 뺀다', () => {
    expect(leftOf(ITEMS, CON, 1)).toBe(4_000_000 - 2_000_000 - 1_200_000 - 570_000)
    expect(leftOf(ITEMS, CON, 'j')).toBe(3_500_000 - 1_870_000 - 1_150_000)
    expect(leftOf(ITEMS, CON, 2)).toBe(3_500_000 - 1_500_000 - 1_000_000 - 570_000)
  })

  it('공동통장으로 옮긴 돈은 우리집 전체 남는 돈을 바꾸지 않는다', () => {
    expect(totalLeft(ITEMS, CON)).toBe(totalLeft(ITEMS, { 1: 0, 2: 0 }))
  })

  it('나갈 돈 반반 / 월급 비율로 — 만원 단위로 나누고 합은 나갈 돈과 같다', () => {
    expect(sharedNeed(ITEMS)).toBe(3_020_000)
    expect(splitContributions(ITEMS, 'half')).toEqual({ 1: 1_510_000, 2: 1_510_000 })
    const byIncome = splitContributions(ITEMS, 'income')
    expect(byIncome[1]).toBe(1_610_000) // 3,020,000 × 400/750 = 1,610,667 → 만원 반올림
    expect(byIncome[1] + byIncome[2]).toBe(3_020_000)
  })
})

describe('저장할 때 합치기', () => {
  const base = [mk('a', 'fixed', '통신', 1, 70_000), mk('b', 'variable', '식비', 2, 500_000)]

  it('내가 안 건드린 항목은 배우자가 그사이 고친 값을 쓴다', () => {
    const server = [base[0], { ...base[1], planned: 600_000 }]
    const mine = [{ ...base[0], planned: 80_000 }, base[1]]
    const out = mergeBudget(server, base, mine)
    expect(out.find((i) => i.id === 'a')!.planned).toBe(80_000)
    expect(out.find((i) => i.id === 'b')!.planned).toBe(600_000)
  })

  it('배우자가 새로 넣은 항목은 남기고, 배우자가 지운 항목은 지운다', () => {
    const added = mk('c', 'variable', '카페', 2, 100_000)
    const out = mergeBudget([base[0], added], base, base)
    expect(out.map((i) => i.id)).toEqual(['a', 'c'])
  })

  it('내가 지운 항목은 서버에 남아 있어도 지운다', () => {
    const out = mergeBudget(base, base, [base[0]])
    expect(out.map((i) => i.id)).toEqual(['a'])
  })
})
