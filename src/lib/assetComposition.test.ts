import { describe, expect, it } from 'vitest'
import { buildComposition, compositionNote } from './assetComposition'
import type { AssetGroup, AssetItem } from '../types'

const a = (id: string, group: AssetGroup, amount: number): AssetItem => ({
  id,
  kind: 'asset',
  group,
  name: id,
  amount,
})

describe('자산 구성 — 나누기', () => {
  const items = [
    a('현금', 'cash', 31_000_000),
    a('연금', 'pension', 6_000_000),
    a('주식', 'stock', 10_500_000),
    a('집', 'realestate', 2_500_000),
  ]

  it('모으는 돈이 먼저, 불리는 돈이 뒤에 온다', () => {
    expect(buildComposition(items).slices.map((s) => s.group)).toEqual([
      'cash',
      'pension',
      'stock',
      'realestate',
    ])
  })

  it('두 덩어리 비율을 따로 알려준다', () => {
    const c = buildComposition(items)
    expect(c.savePercent).toBe(74)
    expect(c.growPercent).toBe(26)
  })

  it('소비재는 이름 없이 기타로 묶인다 — 빼버리면 합이 100%가 안 된다', () => {
    const c = buildComposition([...items, a('차', 'consumable', 2_500_000)])
    const other = c.slices.at(-1)!
    expect(other.group).toBeNull()
    expect(other.kind).toBe('other')
    expect(other.amount).toBe(2_500_000)
    expect(c.total).toBe(52_500_000)
  })

  it('기타가 없으면 그 칸도 없다', () => {
    expect(buildComposition(items).slices.some((s) => s.group === null)).toBe(false)
  })

  it('같은 그룹 항목은 합쳐진다', () => {
    const c = buildComposition([a('통장1', 'cash', 1_000_000), a('통장2', 'cash', 3_000_000)])
    expect(c.slices).toHaveLength(1)
    expect(c.slices[0].amount).toBe(4_000_000)
  })

  it('0원 항목은 칸을 차지하지 않는다', () => {
    const c = buildComposition([...items, a('빈통장', 'cash', 0)])
    expect(c.slices).toHaveLength(4)
  })
})

describe('자산 구성 — 비율 합이 항상 100', () => {
  // 그냥 반올림하면 99%나 101%가 뜬다. 화면에 나가는 숫자라 바로 티가 난다.
  it('3등분처럼 안 떨어지는 경우에도 100이 된다', () => {
    const c = buildComposition([
      a('a', 'cash', 1),
      a('b', 'pension', 1),
      a('c', 'stock', 1),
    ])
    expect(c.slices.reduce((s, x) => s + x.percent, 0)).toBe(100)
  })

  it('7등분처럼 지저분한 경우에도 100이 된다', () => {
    const c = buildComposition([
      a('a', 'cash', 3),
      a('b', 'pension', 1),
      a('c', 'stock', 2),
      a('d', 'realestate', 1),
    ])
    expect(c.slices.reduce((s, x) => s + x.percent, 0)).toBe(100)
  })

  it('아주 작은 항목도 0%로 죽지 않고 반올림 몫을 받는다', () => {
    const c = buildComposition([a('a', 'cash', 999), a('b', 'stock', 1)])
    expect(c.slices.reduce((s, x) => s + x.percent, 0)).toBe(100)
  })
})

describe('자산 구성 — 빈 경우', () => {
  it('자산이 없으면 칸도 없다', () => {
    expect(buildComposition([]).slices).toEqual([])
    expect(buildComposition([]).total).toBe(0)
  })

  it('부채만 있으면(자산 0) 칸이 없다', () => {
    const debt: AssetItem = { id: 'd', kind: 'debt', group: 'cash', name: '대출', amount: 1000 }
    // 화면에서 자산만 넘겨주지만, 혹시 섞여 들어와도 금액이 양수면 잡힌다는 걸 명시
    expect(buildComposition([debt]).slices).toHaveLength(1)
  })
})

describe('자산 구성 — 밑에 붙는 한 줄', () => {
  const note = (items: AssetItem[]) => compositionNote(buildComposition(items))

  it('불리는 돈이 아예 없으면 그렇게 말한다', () => {
    expect(note([a('현금', 'cash', 100)])).toContain('아직은 모으는 데 집중')
  })

  it('모으는 쪽이 70% 이상이면 신혼 초 이야기를 덧붙인다', () => {
    const msg = note([a('현금', 'cash', 80), a('주식', 'stock', 20)])
    expect(msg).toContain('모으는 돈 80% · 불리는 돈 20%')
    expect(msg).toContain('신혼 초엔 자연스러운')
  })

  it('불리는 쪽이 60% 이상이면 그쪽이 크다고만 한다', () => {
    expect(note([a('현금', 'cash', 30), a('주식', 'stock', 70)])).toContain('불리는 쪽 비중이 큰')
  })

  it('애매한 구간엔 판단을 얹지 않는다 — 사정은 집마다 다르다', () => {
    expect(note([a('현금', 'cash', 50), a('주식', 'stock', 50)])).toBe(
      '모으는 돈 50% · 불리는 돈 50%',
    )
  })

  it('자산이 없으면 아무 말도 하지 않는다', () => {
    expect(note([])).toBe('')
  })
})
