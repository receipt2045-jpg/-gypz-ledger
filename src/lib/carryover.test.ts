import { describe, expect, it } from 'vitest'
import { deriveItemsFromPrevious } from './carryover'
import type { BudgetItem } from '../types'

const item = (
  id: string,
  group: BudgetItem['group'],
  category: string,
  member: 1 | 2,
  planned: number,
): BudgetItem => ({ id, group, category, member, planned, actual: planned })

describe('deriveItemsFromPrevious — 이월 항목 ID', () => {
  // 제보 재현: 수입 스텝에 '부수입'이 두 개(20만/5만) 있는 가구에서
  // 부수입 행이 모든 스텝에 유령처럼 나타나고 X로도 안 지워졌다.
  it('같은 (그룹·카테고리·구성원) 항목이 둘이어도 ID가 겹치지 않아야 한다', () => {
    const prev = [
      item('a', 'income', '부수입', 2, 200_000),
      item('b', 'income', '부수입', 2, 50_000),
    ]
    const next = deriveItemsFromPrevious(prev, '2026-08')
    const ids = next.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('서로 다른 항목들의 ID도 모두 고유해야 한다', () => {
    const prev = [
      item('a', 'income', '주수입', 1, 3_000_000),
      item('b', 'income', '부수입', 1, 200_000),
      item('c', 'fixed', '보험', 1, 100_000),
      item('d', 'variable', '식비', 1, 500_000),
    ]
    const ids = deriveItemsFromPrevious(prev, '2026-08').map((i) => i.id)
    expect(new Set(ids).size).toBe(4)
  })

  it('이월해도 그룹·카테고리·구성원은 그대로 유지된다', () => {
    const prev = [item('a', 'income', '부수입', 2, 200_000)]
    const [next] = deriveItemsFromPrevious(prev, '2026-08')
    expect(next).toMatchObject({ group: 'income', category: '부수입', member: 2 })
  })
})
