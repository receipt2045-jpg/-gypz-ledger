import { describe, expect, it } from 'vitest'
import { deriveItemsFromPrevious, mergeAssets, mergeMemberItems } from './carryover'
import type { AssetItem, BudgetItem } from '../types'

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

describe('mergeAssets — 자산 3-way 병합', () => {
  const asset = (id: string, name: string, amount: number): AssetItem => ({
    id,
    kind: 'asset',
    group: 'cash',
    name,
    amount,
  })

  it('화면을 열어둔 사이 배우자가 추가한 자산을 지운다면 안 된다', () => {
    const baseline = [asset('a', '내 통장', 1_000_000)]
    const server = [...baseline, asset('b', '남편 통장', 500_000)] // 그사이 배우자가 추가
    const mine = [asset('a', '내 통장', 1_200_000)] // 나는 내 것만 고침
    const merged = mergeAssets(server, baseline, mine)
    expect(merged.map((i) => i.name).sort()).toEqual(['남편 통장', '내 통장'])
    expect(merged.find((i) => i.id === 'a')?.amount).toBe(1_200_000)
  })

  it('내가 지운 자산은 사라진다', () => {
    const baseline = [asset('a', '해지한 적금', 0), asset('b', '주거래', 300_000)]
    const merged = mergeAssets(baseline, baseline, [asset('b', '주거래', 300_000)])
    expect(merged.map((i) => i.id)).toEqual(['b'])
  })

  it('내가 새로 넣은 자산은 들어간다', () => {
    const baseline: AssetItem[] = []
    const merged = mergeAssets([], baseline, [asset('new', '청약', 100_000)])
    expect(merged).toHaveLength(1)
  })

  it('내가 지운 것과 배우자가 넣은 것이 동시에 있어도 각각 맞게 처리된다', () => {
    const baseline = [asset('a', '해지', 0)]
    const server = [asset('a', '해지', 0), asset('c', '배우자 신규', 700_000)]
    const merged = mergeAssets(server, baseline, [asset('d', '내 신규', 50_000)])
    expect(merged.map((i) => i.id).sort()).toEqual(['c', 'd'])
  })
})
