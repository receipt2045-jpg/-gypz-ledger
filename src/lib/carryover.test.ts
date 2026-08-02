import { describe, expect, it } from 'vitest'
import { deriveItemsFromPrevious, mergeMemberItems } from './carryover'
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

describe('mergeMemberItems — 저장용 병합', () => {
  // 제보 재현: X로 지운 항목이 저장에 반영돼야 한다.
  it('내가 지운 항목은 결과에 남지 않는다', () => {
    const base = [
      item('server-1', 'income', '주수입', 2, 3_000_000),
      item('server-2', 'income', '부수입', 2, 200_000),
    ]
    const mine = [item('server-1', 'income', '주수입', 2, 3_000_000)] // 부수입 삭제
    const merged = mergeMemberItems(base, mine, 2)
    expect(merged.map((i) => i.category)).toEqual(['주수입'])
  })

  it('배우자 항목은 내가 지워도 살아남는다', () => {
    const base = [
      item('h1', 'income', '주수입', 1, 4_000_000),
      item('w1', 'income', '부수입', 2, 200_000),
    ]
    const merged = mergeMemberItems(base, [], 2) // 아내가 자기 항목 전부 삭제
    expect(merged).toHaveLength(1)
    expect(merged[0].member).toBe(1)
  })

  it('내 편집본이 서버 값을 이긴다', () => {
    const base = [item('x', 'variable', '식비', 1, 500_000)]
    const mine = [item('x', 'variable', '식비', 1, 777_777)]
    expect(mergeMemberItems(base, mine, 1)[0].planned).toBe(777_777)
  })

  it('내가 새로 추가한 항목도 들어간다', () => {
    const base = [item('x', 'variable', '식비', 1, 500_000)]
    const mine = [...base, item('y', 'variable', '카페', 1, 50_000)]
    expect(mergeMemberItems(base, mine, 1)).toHaveLength(2)
  })
})
