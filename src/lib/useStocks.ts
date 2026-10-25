import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLedgerStore } from './store'
import { localStocks, remoteStocks, type StockApi } from './stockDb'
import type { Stock, StockEntry } from './stocks'

// ── 둘러보기(예시 가계부)용 예시 일지 ──
const day = (ago: number) => {
  const d = new Date()
  d.setDate(d.getDate() - ago)
  return d.toLocaleDateString('sv-SE')
}
const iso = (ago: number) => new Date(Date.now() - ago * 86_400_000).toISOString()

function sampleStock(p: Partial<Stock> & Pick<Stock, 'id' | 'name' | 'market'>): Stock {
  return {
    owner: 1,
    code: '',
    exchange: '',
    currency: p.market === 'US' ? 'USD' : 'KRW',
    pickReason: '',
    targetPrice: null,
    stopPrice: null,
    sellPlan: '',
    lastPrice: null,
    lastPriceAt: iso(0),
    createdAt: iso(60),
    ...p,
  }
}

function sampleEntry(
  p: Partial<StockEntry> & Pick<StockEntry, 'id' | 'stockId' | 'kind'>,
): StockEntry {
  return {
    memberNo: 1,
    qty: null,
    price: null,
    tradedOn: day(0),
    reasons: [],
    note: '',
    mood: null,
    planKept: null,
    review: '',
    photoPath: null,
    replyTo: null,
    createdAt: iso(0),
    ...p,
  }
}

export const SAMPLE_STOCKS = {
  stocks: [
    sampleStock({
      id: 'sample-hynix',
      name: 'SK하이닉스',
      code: '000660',
      exchange: 'KOSPI',
      market: 'KR',
      owner: 1,
      pickReason: 'HBM 1등, AI 서버가 늘면 같이 큰다',
      targetPrice: 300_000,
      stopPrice: 220_000,
      sellPlan: '30만 되면 반만 팔기',
      lastPrice: 250_000,
    }),
    sampleStock({
      id: 'sample-apple',
      name: '애플',
      code: 'AAPL',
      exchange: 'NASDAQ',
      market: 'US',
      owner: 2,
      targetPrice: 280,
      lastPrice: 228,
    }),
  ],
  entries: [
    sampleEntry({
      id: 'se1',
      stockId: 'sample-hynix',
      kind: 'buy',
      qty: 5,
      price: 160_000,
      tradedOn: day(52),
      createdAt: iso(52),
      reasons: ['실적 좋아서'],
      note: 'HBM 수요 늘어서 내년 실적 기대',
      mood: 'sure',
    }),
    sampleEntry({
      id: 'se2',
      stockId: 'sample-hynix',
      kind: 'comment',
      memberNo: 2,
      note: '목표가 그대로 가? 반은 팔자',
      replyTo: 'se1',
      createdAt: iso(5),
    }),
    sampleEntry({
      id: 'se3',
      stockId: 'sample-hynix',
      kind: 'buy',
      qty: 5,
      price: 240_000,
      tradedOn: day(1),
      createdAt: iso(1),
      reasons: ['실적 좋아서'],
      note: '실적 발표 좋아서 추가',
      mood: 'sure',
    }),
    sampleEntry({
      id: 'se4',
      stockId: 'sample-apple',
      kind: 'holding',
      memberNo: 2,
      qty: 8,
      price: 233,
      tradedOn: day(30),
      createdAt: iso(30),
    }),
  ],
}

// ── 배우자가 새로 남긴 기록 (이 기기에서 그 종목을 마지막으로 본 뒤) ──
const SEEN_KEY = 'moabuli.stocks.seen'

function readSeen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}

export function markStockSeen(stockId: string) {
  try {
    localStorage.setItem(
      SEEN_KEY,
      JSON.stringify({ ...readSeen(), [stockId]: new Date().toISOString() }),
    )
  } catch {
    // 저장이 막힌 브라우저 — 새 기록 표시가 계속 남을 뿐이다
  }
}

/** 종목별로 배우자가 내가 마지막으로 본 뒤에 남긴 기록 수 */
export function unseenBySpouse(entries: StockEntry[], me: 1 | 2): Record<string, number> {
  const seen = readSeen()
  const out: Record<string, number> = {}
  for (const e of entries) {
    if (e.memberNo === me) continue
    const at = seen[e.stockId]
    if (!at || e.createdAt > at) out[e.stockId] = (out[e.stockId] ?? 0) + 1
  }
  return out
}

/**
 * 주식 일지 데이터 — 로그인했으면 서버, 둘러보기면 예시(메모리).
 * 고칠 때마다 다시 불러온다 — 부부 둘이 동시에 쓰는 화면이라 남이 바꾼 것도 같이 보이게.
 */
export function useStocks() {
  const householdId = useLedgerStore((s) => s.householdId)
  const memberNo = useLedgerStore((s) => s.memberNo) ?? 1
  const api: StockApi = useMemo(
    () => (householdId ? remoteStocks(householdId, memberNo) : localStocks(SAMPLE_STOCKS)),
    [householdId, memberNo],
  )
  const [stocks, setStocks] = useState<Stock[]>([])
  const [entries, setEntries] = useState<StockEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const reload = useCallback(async () => {
    try {
      const d = await api.load()
      setStocks(d.stocks)
      setEntries(d.entries)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [api])

  useEffect(() => {
    void reload()
  }, [reload])

  return { api, stocks, entries, status, reload, me: memberNo, sample: !householdId }
}
