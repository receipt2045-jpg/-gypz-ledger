import { describe, expect, it } from 'vitest'
import {
  confessEntries,
  confessSums,
  missingConfessedItems,
  monthConfessions,
  ymOfIso,
} from './confessLedger'
import type { BudgetItem, Confession } from '../types'

const c = (
  id: string,
  memberNo: 1 | 2,
  kind: Confession['kind'],
  category: string,
  amount: number,
  createdAt: string,
): Confession => ({ id, memberNo, kind, category, amount, createdAt })

// 로컬 시간 기준 ISO 문자열 (테스트가 실행 환경 타임존에 흔들리지 않게)
const localIso = (y: number, m: number, d: number, h = 12) =>
  new Date(y, m - 1, d, h).toISOString()

const item = (member: 1 | 2, group: BudgetItem['group'], category: string): BudgetItem => ({
  id: `${member}-${group}-${category}`,
  group,
  category,
  member,
  planned: 0,
  actual: 0,
})

describe('ymOfIso — 로컬 시간 기준 월', () => {
  it('로컬 날짜의 달을 돌려준다', () => {
    expect(ymOfIso(localIso(2026, 8, 15))).toBe('2026-08')
  })
  it('월말 자정 직전도 그 달로 유지된다', () => {
    expect(ymOfIso(localIso(2026, 8, 31, 23))).toBe('2026-08')
  })
  it('월초 자정 직후도 그 달로 유지된다', () => {
    expect(ymOfIso(localIso(2026, 9, 1, 0))).toBe('2026-09')
  })
})

describe('monthConfessions', () => {
  const list = [
    c('1', 1, 'variable', '식비', 9000, localIso(2026, 8, 1)),
    c('2', 2, 'variable', '카페', 5500, localIso(2026, 8, 20)),
    c('3', 1, 'variable', '식비', 3000, localIso(2026, 7, 30)),
  ]
  it('해당 월만 걸러낸다', () => {
    expect(monthConfessions(list, '2026-08').map((x) => x.id)).toEqual(['1', '2'])
  })
  it('없는 달은 빈 배열', () => {
    expect(monthConfessions(list, '2026-12')).toEqual([])
  })
})

describe('confessSums — 구성원·그룹·카테고리별 합계', () => {
  const list = [
    c('1', 1, 'variable', '식비', 9000, localIso(2026, 8, 1)),
    c('2', 1, 'variable', '식비', 6000, localIso(2026, 8, 2)),
    c('3', 2, 'variable', '식비', 4000, localIso(2026, 8, 3)),
    c('4', 1, 'fixed', '구독', 17000, localIso(2026, 8, 4)),
    c('5', 1, 'variable', '식비', 1000, localIso(2026, 7, 9)), // 다른 달
  ]
  it('같은 사람·같은 카테고리는 합산', () => {
    expect(confessSums(list, '2026-08').get('1:variable:식비')).toBe(15000)
  })
  it('사람이 다르면 따로 집계', () => {
    expect(confessSums(list, '2026-08').get('2:variable:식비')).toBe(4000)
  })
  it('그룹이 다르면 따로 집계', () => {
    expect(confessSums(list, '2026-08').get('1:fixed:구독')).toBe(17000)
  })
  it('다른 달은 섞이지 않는다', () => {
    expect(confessSums(list, '2026-08').get('1:variable:식비')).not.toBe(16000)
  })

  it('무지출(0원)은 정산 합계에 잡히지 않는다', () => {
    const withNoSpend = [...list, c('n1', 1, 'variable', '무지출', 0, localIso(2026, 8, 5))]
    const sums = confessSums(withNoSpend, '2026-08')
    expect(sums.has('1:variable:무지출')).toBe(false)
    expect(sums.get('1:variable:식비')).toBe(15000) // 나머지는 그대로
  })
})

describe('confessEntries — 합계 밑에 펼쳐 볼 내역', () => {
  const list = [
    c('1', 1, 'variable', '식비', 9000, localIso(2026, 8, 1)),
    c('2', 1, 'variable', '식비', 6000, localIso(2026, 8, 3)),
    c('3', 2, 'variable', '식비', 4000, localIso(2026, 8, 2)),
    c('4', 1, 'variable', '식비', 1000, localIso(2026, 7, 9)), // 다른 달
  ]

  it('합계와 같은 키로 묶인다', () => {
    expect(confessEntries(list, '2026-08').get('1:variable:식비')?.map((e) => e.id)).toEqual([
      '2',
      '1',
    ])
  })

  it('최근 것이 위에 온다', () => {
    const got = confessEntries(list, '2026-08').get('1:variable:식비')!
    expect(got[0].id).toBe('2') // 8/3
    expect(got[1].id).toBe('1') // 8/1
  })

  it('사람이 다르면 섞이지 않는다', () => {
    expect(confessEntries(list, '2026-08').get('2:variable:식비')?.map((e) => e.id)).toEqual(['3'])
  })

  it('다른 달은 들어오지 않는다', () => {
    expect(confessEntries(list, '2026-08').get('1:variable:식비')).toHaveLength(2)
  })

  it('내역 합이 합계와 정확히 같다 — 어긋나면 사용자가 앱을 못 믿는다', () => {
    const withNoSpend = [...list, c('n1', 1, 'variable', '무지출', 0, localIso(2026, 8, 5))]
    const sums = confessSums(withNoSpend, '2026-08')
    const logs = confessEntries(withNoSpend, '2026-08')
    for (const [key, total] of sums) {
      const listed = (logs.get(key) ?? []).reduce((a, e) => a + e.amount, 0)
      expect(listed).toBe(total)
    }
    expect(logs.has('1:variable:무지출')).toBe(false)
  })
})

describe('missingConfessedItems — 정산에 빠진 고백 항목', () => {
  const sums = new Map([
    ['1:variable:식비', 150000],
    ['1:variable:카페', 42000],
    ['1:fixed:구독', 17000],
    ['2:variable:식비', 30000],
  ])

  it('목록에 없는 항목만, 금액 큰 순으로 돌려준다', () => {
    const got = missingConfessedItems(sums, 1, ['variable'], [])
    expect(got).toEqual([
      { group: 'variable', category: '식비', amount: 150000 },
      { group: 'variable', category: '카페', amount: 42000 },
    ])
  })

  it('이미 정산 목록에 있으면 제외한다', () => {
    const got = missingConfessedItems(sums, 1, ['variable'], [item(1, 'variable', '식비')])
    expect(got.map((g) => g.category)).toEqual(['카페'])
  })

  it('다른 구성원의 고백은 넘어오지 않는다', () => {
    const got = missingConfessedItems(sums, 2, ['variable'], [])
    expect(got).toEqual([{ group: 'variable', category: '식비', amount: 30000 }])
  })

  it('현재 스텝의 그룹만 본다', () => {
    const got = missingConfessedItems(sums, 1, ['fixed'], [])
    expect(got).toEqual([{ group: 'fixed', category: '구독', amount: 17000 }])
  })

  it('배우자가 같은 카테고리를 가지고 있어도 내 것은 여전히 빠진 항목', () => {
    const got = missingConfessedItems(sums, 1, ['variable'], [item(2, 'variable', '식비')])
    expect(got.map((g) => g.category)).toEqual(['식비', '카페'])
  })

  it('예산 모드(합계 없음)에선 빈 배열', () => {
    expect(missingConfessedItems(null, 1, ['variable'], [])).toEqual([])
  })

  it("카테고리명에 ':'가 있어도 온전히 복원한다", () => {
    const odd = new Map([['1:variable:커피:테이크아웃', 5000]])
    expect(missingConfessedItems(odd, 1, ['variable'], [])).toEqual([
      { group: 'variable', category: '커피:테이크아웃', amount: 5000 },
    ])
  })
})
