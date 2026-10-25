import { describe, expect, it } from 'vitest'
import {
  moodReturns,
  parseStockLine,
  positionOf,
  searchStocks,
  targetProgress,
  toTargetRate,
  valuationOf,
  type Stock,
  type StockEntry,
  type StockListRow,
} from './stocks'

const e = (p: Partial<StockEntry>): StockEntry => ({
  id: Math.random().toString(),
  stockId: 's1',
  memberNo: 1,
  kind: 'buy',
  qty: null,
  price: null,
  tradedOn: '2026-10-01',
  reasons: [],
  note: '',
  mood: null,
  planKept: null,
  review: '',
  photoPath: null,
  replyTo: null,
  createdAt: '2026-10-01T00:00:00Z',
  ...p,
})

describe('보유 계산 — 평균단가법', () => {
  it('두 번 사면 평균, 팔면 실현손익, 남은 건 평균 그대로', () => {
    const pos = positionOf([
      e({ kind: 'buy', qty: 5, price: 160_000, tradedOn: '2026-09-03' }),
      e({ kind: 'buy', qty: 5, price: 240_000, tradedOn: '2026-10-24' }),
      e({ kind: 'sell', qty: 5, price: 300_000, tradedOn: '2026-10-25' }),
      e({ kind: 'memo', note: '메모는 계산에 안 들어간다' }),
    ])
    expect(pos.qty).toBe(5)
    expect(pos.avgPrice).toBe(200_000)
    expect(pos.realized).toBe(500_000)
    expect(pos.cost).toBe(1_000_000)
  })

  it('원래 갖고 있던 것(holding)도 산 것처럼', () => {
    expect(positionOf([e({ kind: 'holding', qty: 30, price: 61_200 })]).avgPrice).toBe(61_200)
  })

  it('다 팔면 0주', () => {
    const pos = positionOf([
      e({ kind: 'buy', qty: 0.5, price: 180 }),
      e({ kind: 'sell', qty: 0.5, price: 200, tradedOn: '2026-10-02' }),
    ])
    expect(pos.qty).toBe(0)
    expect(pos.realized).toBe(10)
  })
})

describe('지금 금액 · 목표가', () => {
  const stock = { lastPrice: 250_000, targetPrice: 300_000, stopPrice: 220_000 }
  const pos = positionOf([e({ qty: 10, price: 200_000 })])

  it('현재가가 있으면 평가손익, 없으면 들어간 돈만', () => {
    expect(valuationOf(stock, pos)).toEqual({
      value: 2_500_000,
      pnl: 500_000,
      rate: 0.25,
      priced: true,
    })
    expect(valuationOf({ lastPrice: null }, pos)).toEqual({
      value: 2_000_000,
      pnl: null,
      rate: null,
      priced: false,
    })
  })

  it('손절가~목표가 사이 위치와 목표까지 남은 %', () => {
    expect(targetProgress(stock, pos.avgPrice)).toBeCloseTo(30 / 80)
    expect(toTargetRate(stock)).toBeCloseTo(0.2)
    expect(targetProgress({ ...stock, stopPrice: null }, pos.avgPrice)).toBeCloseTo(0.5)
  })

  it('기분별 수익률', () => {
    const s = { id: 's1', lastPrice: 120 } as Stock
    const r = moodReturns(
      [s],
      [e({ qty: 1, price: 100, mood: 'sure' }), e({ qty: 1, price: 150, mood: 'follow' })],
    )
    expect(r.find((x) => x.mood === 'sure')?.rate).toBeCloseTo(0.2)
    expect(r.find((x) => x.mood === 'follow')?.rate).toBeCloseTo(-0.2)
  })
})

describe('한 줄 입력', () => {
  it.each([
    ['하이닉스 10주', { query: '하이닉스', qty: 10, price: null, side: 'buy' }],
    ['하이닉스 10주 24만', { query: '하이닉스', qty: 10, price: 240_000, side: 'buy' }],
    ['애플 3주 180달러', { query: '애플', qty: 3, price: 180, side: 'buy' }],
    ['삼전 5주 팔았어 7만원', { query: '삼전', qty: 5, price: 70_000, side: 'sell' }],
    ['KODEX 200 3주', { query: 'KODEX 200', qty: 3, price: null, side: 'buy' }],
    ['테슬라 0.5주 $250', { query: '테슬라', qty: 0.5, price: 250, side: 'buy' }],
    ['카카오 2주 41,500', { query: '카카오', qty: 2, price: 41_500, side: 'buy' }],
  ])('%s', (input, want) => {
    expect(parseStockLine(input)).toEqual(want)
  })
})

describe('종목 찾기', () => {
  const list: StockListRow[] = [
    ['SK하이닉스', '000660', 'P'],
    ['삼성전자', '005930', 'P'],
    ['삼성전자우', '005935', 'P'],
    ['KODEX 200', '', 'E'],
    ['애플', 'AAPL', 'U', 'N'],
    ['아이온큐', 'IONQ', 'U', 'Y'],
  ]
  it('줄임말·코드·티커', () => {
    expect(searchStocks(list, '하이닉스')[0].name).toBe('SK하이닉스')
    expect(searchStocks(list, '삼전')[0].name).toBe('삼성전자')
    expect(searchStocks(list, '삼성전자')[0].name).toBe('삼성전자')
    expect(searchStocks(list, '005930')[0].code).toBe('005930')
    expect(searchStocks(list, 'aapl')[0]).toMatchObject({
      name: '애플',
      market: 'US',
      exchange: 'NASDAQ',
      label: 'AAPL · 나스닥',
    })
    expect(searchStocks(list, '아이온큐')[0].label).toBe('IONQ · 뉴욕증권거래소')
    expect(searchStocks(list, '하이닉스')[0].label).toBe('코스피 · 000660')
    expect(searchStocks(list, 'kodex200')[0].name).toBe('KODEX 200')
  })
})
