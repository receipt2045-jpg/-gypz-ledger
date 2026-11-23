import { describe, expect, it } from 'vitest'
import {
  applyToAssets,
  kindOfCategory,
  parseAmountCell,
  parseDateCell,
  parsePastedRows,
  SIDE_CATEGORIES,
  applyToLedger,
  dueRepeats,
  livingSplit,
  savedAmount,
  summarizeSide,
  yearSide,
  type SideAllocation,
  type SideIncome,
} from './sideIncome'
import type { AssetItem, MonthlyLedger } from '../types'

let n = 0
const e = (p: Partial<SideIncome>): SideIncome => ({
  id: `e${++n}`,
  memberNo: 1,
  kind: 'cash',
  category: '앱테크',
  amount: 10_000,
  earnedOn: '2026-11-10',
  createdAt: '2026-11-10T00:00:00Z',
  ...p,
})

describe('부수입 합계 (2026-11-19)', () => {
  const list = [
    e({ amount: 30_000 }),
    e({ memberNo: 2, category: '원고료', amount: 150_000 }),
    e({ memberNo: 2, kind: 'saved', category: '체험단', amount: 50_000 }),
    e({ shared: true, kind: 'saved', category: '포인트 결제', amount: 20_000 }),
    e({ amount: 99_000, earnedOn: '2026-10-31' }), // 다른 달
  ]

  it('들어온 돈·아낀 돈·누가·종류별로 나눠 센다 (그 달만)', () => {
    const s = summarizeSide(list, '2026-11')
    expect(s.cash).toBe(180_000)
    expect(s.saved).toBe(70_000)
    expect(s.total).toBe(250_000)
    expect(s.byWho).toEqual({ 1: 30_000, 2: 200_000, shared: 20_000 })
    expect(s.byCategory.cash.map((c) => c.category)).toEqual(['원고료', '앱테크'])
  })

  it('올해 합계는 그 달까지', () => {
    expect(yearSide(list, '2026-11')).toEqual({ cash: 279_000, saved: 70_000, spent: 0 })
    expect(yearSide(list, '2026-10')).toEqual({ cash: 99_000, saved: 0, spent: 0 })
  })

  it('아낀 돈 = 원래 값 − 낸 돈 (음수면 0)', () => {
    expect(savedAmount(60_000, 10_000)).toBe(50_000)
    expect(savedAmount(10_000, 20_000)).toBe(0)
  })

  it('살림에 보탤 돈은 그 달 번 비율대로 나눈다 (공동은 반반)', () => {
    const cash = [
      e({ amount: 30_000 }),
      e({ memberNo: 2, amount: 60_000 }),
      e({ shared: true, amount: 20_000 }),
    ]
    // 남편 40,000 : 아내 70,000
    expect(livingSplit(cash, '2026-11', 110_000, 1)).toEqual({ 1: 40_000, 2: 70_000 })
    // 번 돈이 없으면 정산한 사람 몫
    expect(livingSplit([], '2026-11', 5_000, 2)).toEqual({ 1: 0, 2: 5_000 })
  })
})

describe('부수입 정산 — 보낸 곳에 더하고, 마감을 풀면 뺀다', () => {
  const items: AssetItem[] = [
    { id: 'a', kind: 'asset', group: 'cash', name: '토스 비상금', amount: 1_000_000 },
    { id: 'b', kind: 'asset', group: 'stock', name: '토스증권 주식', amount: 2_000_000 },
  ]
  const allocs: SideAllocation[] = [
    { to: 'asset', assetId: 'a', assetName: '토스 비상금', amount: 100_000 },
    // 이어 온 달이라 id가 달라도 이름으로
    { to: 'asset', assetId: 'old-id', assetName: '토스증권 주식', amount: 50_000 },
    { to: 'asset', assetId: 'gone', assetName: '없는 통장', amount: 7_000 },
    { to: 'living', amount: 30_000, split: { 1: 10_000, 2: 20_000 } },
  ]

  it('자산 통장 — 더하고 다시 빼면 그대로', () => {
    const added = applyToAssets(items, allocs, 1)
    expect(added.map((i) => i.amount)).toEqual([1_100_000, 2_050_000])
    expect(applyToAssets(added, allocs, -1)).toEqual(items)
  })

  it("살림 — 그 달 가계부 '부수입'에 남편·아내 몫으로, 없으면 칸을 만든다", () => {
    const ledger: MonthlyLedger = {
      ym: '2026-11',
      closed: false,
      items: [
        { id: 'i1', group: 'income', category: '부수입', member: 1, planned: 0, actual: 5_000 },
      ],
    }
    const added = applyToLedger(ledger, allocs, 1)
    const side = (m: 1 | 2) =>
      added.items.find((it) => it.category === '부수입' && it.member === m)?.actual
    expect(side(1)).toBe(15_000)
    expect(side(2)).toBe(20_000)
    const back = applyToLedger(added, allocs, -1)
    expect(back.items.find((it) => it.id === 'i1')?.actual).toBe(5_000)
    expect(back.items.find((it) => it.member === 2)?.actual).toBe(0)
  })
})

describe('엑셀에서 붙여넣기 (2026-11-23)', () => {
  const opts = { year: '2026', names: ['결영', '남편이'] as [string, string], me: 2 as const }

  it('날짜·금액 모양을 알아본다', () => {
    expect(parseDateCell('2026-11-03', '2026')).toBe('2026-11-03')
    expect(parseDateCell('2026.11.3', '2026')).toBe('2026-11-03')
    expect(parseDateCell('11/3', '2026')).toBe('2026-11-03')
    expect(parseDateCell('11월 3일', '2026')).toBe('2026-11-03')
    expect(parseDateCell('앱테크', '2026')).toBeNull()
    expect(parseAmountCell('12,000원')).toBe(12_000)
    expect(parseAmountCell('₩ 3,500')).toBe(3_500)
    expect(parseAmountCell('1.2만')).toBe(12_000)
    expect(parseAmountCell('메모')).toBeNull()
  })

  it('칸 순서가 달라도 읽고, 머리줄·빈 줄은 뺀다', () => {
    const text = [
      '날짜\t종류\t금액\t누가\t메모',
      '11/3\t앱테크\t32,000\t결영\t캐시워크',
      '2026-11-05\t아낀 돈\t체험단\t50000\t남편이\t성수 파스타',
      '',
      '11월 9일\t28000\t공동\t당근 판매\t아기 옷',
    ].join('\n')
    const { rows, skipped } = parsePastedRows(text, opts)
    expect(skipped).toBe(1)
    expect(rows).toEqual([
      {
        earnedOn: '2026-11-03',
        kind: 'cash',
        category: '앱테크',
        amount: 32_000,
        who: 1,
        note: '캐시워크',
      },
      {
        earnedOn: '2026-11-05',
        kind: 'saved',
        category: '체험단',
        amount: 50_000,
        who: 2,
        note: '성수 파스타',
      },
      // 목록에 없는 종류는 그대로, 누가가 없으면 나(2)
      {
        earnedOn: '2026-11-09',
        kind: 'cash',
        category: '당근 판매',
        amount: 28_000,
        who: 'shared',
        note: '아기 옷',
      },
    ])
  })

  it('종류가 아낀 돈 목록에만 있으면 아낀 돈으로', () => {
    expect(kindOfCategory('체험단')).toBe('saved')
    expect(kindOfCategory('기타')).toBe('cash')
    expect(kindOfCategory('당근 판매')).toBe('cash')
  })
})

describe('쓴 돈 · 매달 (2026-11-23)', () => {
  it('쓴 돈은 번 돈에서 빼서 남은 돈, 누가에서도 뺀다', () => {
    const list = [
      e({ amount: 100_000 }),
      e({ kind: 'saved', category: '체험단', amount: 30_000 }),
      e({ kind: 'spent', category: '구독·프로그램', amount: 12_000 }),
    ]
    const s = summarizeSide(list, '2026-11')
    expect(s.spent).toBe(12_000)
    expect(s.net).toBe(88_000)
    expect(s.total).toBe(118_000)
    expect(s.byWho[1]).toBe(118_000)
    expect(s.byCategory.spent).toEqual([{ category: '구독·프로그램', amount: 12_000 }])
  })

  it('쓴 돈 종류·말을 알아본다', () => {
    expect(kindOfCategory('수수료')).toBe('spent')
    const { rows } = parsePastedRows('11/4\t지출\t교통비\t4,800', {
      year: '2026',
      names: ['a', 'b'],
      me: 1,
    })
    expect(rows[0]).toMatchObject({ kind: 'spent', category: '교통비', amount: 4_800 })
  })

  it('매달 — 다음 달부터 오늘까지 같은 날(말일 넘으면 말일)로, 한 번만', () => {
    const sub = e({
      id: 's1',
      kind: 'spent',
      category: '구독·프로그램',
      amount: 9_900,
      earnedOn: '2026-08-31',
      repeat: true,
    })
    const due = dueRepeats([sub], '2026-11-23')
    expect(due.map((d) => d.earnedOn)).toEqual(['2026-09-30', '2026-10-31'])
    expect(due.every((d) => d.series === 's1' && d.repeat)).toBe(true)
    // 다시 돌려도 같은 id — 서버가 겹치면 건너뛴다
    expect(dueRepeats([sub], '2026-11-23').map((d) => d.id)).toEqual(due.map((d) => d.id))
    // 다 채웠으면 더 없다 (11/30은 아직)
    expect(dueRepeats([sub, ...due], '2026-11-23')).toEqual([])
  })

  it('가장 최근 기록의 매달을 끄면 멈춘다', () => {
    const first = e({ id: 's1', earnedOn: '2026-09-05', repeat: true })
    const last = e({ id: 's2', series: 's1', earnedOn: '2026-10-05', repeat: false })
    expect(dueRepeats([first, last], '2026-11-23')).toEqual([])
  })
})

describe('번 돈 종류 세분화 (2026-11-23)', () => {
  it('원고료·협찬비를 나누고 광고 수익·지식 판매·강의·상담이 있다', () => {
    expect(SIDE_CATEGORIES.cash).toEqual(
      expect.arrayContaining(['원고료', '협찬비', '광고 수익', '지식 판매', '강의·상담']),
    )
    expect(SIDE_CATEGORIES.cash).not.toContain('원고료·협찬비')
  })

  it('붙여넣기·엑셀의 다른 이름을 종류로 — 애드포스트는 광고 수익(메모 애드포스트), 예전 이름도', () => {
    const opts = { year: '2026', names: ['a', 'b'] as [string, string], me: 1 as const }
    const { rows } = parsePastedRows(
      [
        '11/3\t애드포스트\t47,800\t10월분',
        '11/4\t원고료·협찬비\t150000',
        '11/5\t전자책\t9,900',
      ].join('\n'),
      opts,
    )
    expect(rows.map((r) => [r.category, r.note])).toEqual([
      ['광고 수익', '애드포스트 10월분'],
      ['원고료', undefined],
      ['지식 판매', '전자책'],
    ])
  })
})
