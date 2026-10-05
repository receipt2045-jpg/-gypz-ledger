import { describe, expect, it } from 'vitest'
import { groupRows, memberTable, ownerRows, percents } from './assetGlance'
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
