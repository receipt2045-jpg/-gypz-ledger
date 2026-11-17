import { describe, expect, it } from 'vitest'
import { groupRows, memberTable, monthCompare, ownerRows, percents } from './assetGlance'
import type { AssetItem } from '../types'

const a = (
  name: string,
  group: AssetItem['group'],
  amount: number,
  owner?: string,
  kind: AssetItem['kind'] = 'asset',
): AssetItem => ({ id: name, kind, group, name, amount, owner })

const items: AssetItem[] = [
  a('토스 비상금', 'cash', 20_250_000, '공동'),
  a('신한 주택청약', 'cash', 6_500_000, '남편'),
  a('우리 주택청약', 'cash', 6_000_000, '아내'),
  a('토스증권 주식', 'stock', 34_500_000, '공동'),
  a('업비트 코인', 'stock', 4_100_000, '아내'),
  a('전세보증금', 'realestate', 300_000_000, '공동'),
  a('연금저축', 'pension', 9_500_000, '공동'),
  a('자동차', 'consumable', 14_250_000, '남편'),
  a('전세자금대출', 'realestate', 120_000_000, '공동', 'debt'),
  a('신용대출', 'cash', 22_000_000, '남편', 'debt'),
]

describe('자산 한눈에 — 함께 (전체 자산 기준)', () => {
  it('종류별 합계를 금액 큰 순으로, 새 이름으로', () => {
    const rows = groupRows(items)
    expect(rows.map((r) => `${r.label} ${r.pct}`)).toEqual([
      '집 76',
      '투자 10',
      '예적금 8',
      '기타 4',
      '연금 2',
    ])
  })

  it('비율 합은 늘 100', () => {
    expect(percents([1, 1, 1]).reduce((x, y) => x + y, 0)).toBe(100)
    expect(groupRows(items).reduce((x, r) => x + r.pct, 0)).toBe(100)
  })

  it('누구 이름으로 — 자산만, 공동은 주인 안 정한 것까지', () => {
    const rows = ownerRows([...items, a('주인없음', 'cash', 1_000_000)], ['남편', '아내', '공동'])
    expect(rows.find((r) => r.name === '남편')!.amount).toBe(20_750_000)
    expect(rows.find((r) => r.name === '공동')!.amount).toBe(365_250_000)
  })
})

describe('자산 한눈에 — 사람별 표', () => {
  it('남편 표: 종류 순서대로, 자산 합계·부채·순자산', () => {
    const t = memberTable(items.filter((it) => it.owner === '남편'))
    expect(t.assets.map((r) => `${r.label}/${r.name}/${r.pct}`)).toEqual([
      '예적금/신한 주택청약/31',
      '기타/자동차/69',
    ])
    expect(t.assetTotal).toBe(20_750_000)
    expect(t.debts.map((r) => r.name)).toEqual(['신용대출'])
    expect(t.net).toBe(-1_250_000)
  })
})

describe('흐름에서 고른 달 — 지난달과 비교 (2026-11-17)', () => {
  const prev: AssetItem[] = [
    {
      id: 'p1',
      kind: 'asset',
      group: 'realestate',
      name: '아파트',
      amount: 1_000_000_000,
      owner: '공동',
    },
    { id: 'p2', kind: 'asset', group: 'cash', name: '청약', amount: 5_000_000, owner: '남편' },
    { id: 'p3', kind: 'asset', group: 'stock', name: '코인', amount: 3_000_000, owner: '아내' },
    {
      id: 'p4',
      kind: 'debt',
      group: 'realestate',
      name: '주담대',
      amount: 500_000_000,
      owner: '공동',
    },
  ]
  // 이어 온 달이라 id가 다르다
  const cur: AssetItem[] = [
    {
      id: 'c1',
      kind: 'asset',
      group: 'realestate',
      name: '아파트',
      amount: 1_000_000_000,
      owner: '공동',
    },
    { id: 'c2', kind: 'asset', group: 'cash', name: '청약', amount: 6_000_000, owner: '남편' },
    { id: 'c5', kind: 'asset', group: 'cash', name: '비상금', amount: 2_000_000, owner: '공동' },
    {
      id: 'c4',
      kind: 'debt',
      group: 'realestate',
      name: '주담대',
      amount: 498_000_000,
      owner: '공동',
    },
  ]

  it('종류별·합계·부채·순자산 증감', () => {
    const c = monthCompare(cur, prev)
    expect(c.groups.map((r) => `${r.label} ${r.amount} ${r.diff}`)).toEqual([
      '집 1000000000 0',
      '예적금 8000000 3000000',
      '투자 0 -3000000',
    ])
    expect(c.assetTotal.diff).toBe(0)
    expect(c.debt.diff).toBe(-2_000_000)
    // 빚이 200만 줄어 순자산은 200만 늘었다
    expect(c.net.diff).toBe(2_000_000)
  })

  it('바뀐 항목 — 이름·주인으로 맞추고, 새로 생긴 것·없어진 것도', () => {
    const c = monthCompare(cur, prev)
    expect(c.changed.map((it) => `${it.name} ${it.diff}`)).toEqual([
      '코인 -3000000',
      '비상금 2000000',
      '주담대 -2000000',
      '청약 1000000',
    ])
  })

  it('비교할 달이 없으면 증감은 비워 둔다', () => {
    const c = monthCompare(cur, null)
    expect(c.groups.every((r) => r.diff === null)).toBe(true)
    expect(c.changed).toEqual([])
  })
})
