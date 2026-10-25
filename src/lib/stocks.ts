// ── 주식 일지 (2026-10-25) ──
// 종목 하나 = 일지 한 장. 사고판 기록이 종목별로 쌓이고, 부부가 같이 보며 한 줄씩 남긴다.
// 현재가는 받아 오지 않는다 — 캡처에서 읽거나 직접 넣은 값(lastPrice)으로만 계산한다.
// DB는 supabase/stock-journal.sql, 화면은 pages/Stocks.tsx · pages/StockJournal.tsx.

export type StockMarket = 'KR' | 'US'
export type StockOwner = 1 | 2 | 'shared'
export type EntryKind = 'holding' | 'buy' | 'sell' | 'memo' | 'comment'
export type Mood = 'sure' | 'anxious' | 'rushed' | 'follow'
export type PlanKept = 'target' | 'early' | 'stop' | 'unplanned'

export interface Stock {
  id: string
  owner: StockOwner
  market: StockMarket
  code: string
  name: string
  currency: 'KRW' | 'USD'
  pickReason: string
  targetPrice: number | null
  stopPrice: number | null
  sellPlan: string
  lastPrice: number | null
  lastPriceAt: string | null
  createdAt: string
}

export interface StockEntry {
  id: string
  stockId: string
  memberNo: 1 | 2
  kind: EntryKind
  qty: number | null
  price: number | null
  tradedOn: string // 'YYYY-MM-DD'
  reasons: string[]
  note: string
  mood: Mood | null
  planKept: PlanKept | null
  review: string
  photoPath: string | null
  replyTo: string | null
  createdAt: string
}

export const MOODS: { key: Mood; emoji: string; label: string }[] = [
  { key: 'sure', emoji: '😤', label: '확신' },
  { key: 'anxious', emoji: '😰', label: '불안' },
  { key: 'rushed', emoji: '🏃', label: '조급' },
  { key: 'follow', emoji: '👀', label: '남들 따라' },
]

export const BUY_REASONS = [
  '실적 좋아서',
  '더 싸져서',
  '배당',
  '오래 들고 갈 것',
  '뉴스 보고',
  '배우자 추천',
]
export const SELL_REASONS = ['목표가 와서', '손절', '돈 쓸 데가 생겨서', '더 좋은 종목', '불안해서']

export const PLAN_KEPT: { key: PlanKept; label: string }[] = [
  { key: 'target', label: '네, 목표가에서' },
  { key: 'early', label: '일찍 팔았어요' },
  { key: 'stop', label: '손절했어요' },
  { key: 'unplanned', label: '계획에 없었어요' },
]

/** 배우자 빠른 반응 — 한 줄(comment)로 남는다 */
export const QUICK_REACTIONS = ['👍 좋아', '🤔 왜?', '🙏 목표 지키기', '😱 너무 많이 샀어']

// ── 보유 계산 ─────────────────────────────────

export interface Position {
  qty: number
  /** 평균 단가 (남은 주식 기준) */
  avgPrice: number
  /** 남은 주식에 들어간 돈 */
  cost: number
  /** 판 것에서 실제로 번(잃은) 돈 */
  realized: number
}

/** 사고판 순서대로 — 같은 날이면 적은 순서 */
const byTrade = (a: StockEntry, b: StockEntry) =>
  a.tradedOn === b.tradedOn
    ? a.createdAt < b.createdAt
      ? -1
      : 1
    : a.tradedOn < b.tradedOn
      ? -1
      : 1

/** 기록으로 지금 몇 주, 평균 얼마인지 — 평균단가법(파는 만큼 평균단가로 덜어낸다) */
export function positionOf(entries: StockEntry[]): Position {
  let qty = 0
  let cost = 0
  let realized = 0
  for (const e of [...entries].sort(byTrade)) {
    if (!e.qty || e.price == null) continue
    if (e.kind === 'buy' || e.kind === 'holding') {
      qty += e.qty
      cost += e.qty * e.price
    } else if (e.kind === 'sell') {
      const q = Math.min(e.qty, qty)
      if (q <= 0) continue
      const avg = cost / qty
      realized += q * (e.price - avg)
      cost -= q * avg
      qty -= q
    }
  }
  // 소수점 주식에서 생기는 아주 작은 찌꺼기는 0으로
  if (Math.abs(qty) < 1e-9) {
    qty = 0
    cost = 0
  }
  return { qty, avgPrice: qty > 0 ? cost / qty : 0, cost, realized }
}

export interface Valuation {
  /** 지금 금액 — 현재가를 모르면 들어간 돈 */
  value: number
  /** 평가손익 — 현재가를 모르면 null */
  pnl: number | null
  rate: number | null
  priced: boolean
}

export function valuationOf(stock: Pick<Stock, 'lastPrice'>, pos: Position): Valuation {
  if (stock.lastPrice == null || pos.qty <= 0) {
    return { value: pos.cost, pnl: null, rate: null, priced: false }
  }
  const value = pos.qty * stock.lastPrice
  const pnl = value - pos.cost
  return { value, pnl, rate: pos.cost > 0 ? pnl / pos.cost : null, priced: true }
}

/**
 * 손절가 ~ 목표가 사이에서 지금 가격이 어디쯤인지 (0~1).
 * 손절가가 없으면 평균단가부터 본다. 계산할 수 없으면 null.
 */
export function targetProgress(
  stock: Pick<Stock, 'lastPrice' | 'targetPrice' | 'stopPrice'>,
  avgPrice: number,
): number | null {
  const { lastPrice, targetPrice } = stock
  if (lastPrice == null || !targetPrice) return null
  const floor = stock.stopPrice ?? avgPrice
  if (targetPrice <= floor) return null
  return Math.min(1, Math.max(0, (lastPrice - floor) / (targetPrice - floor)))
}

/** 목표가까지 몇 % 더 올라야 하는지 (이미 넘었으면 0) */
export function toTargetRate(stock: Pick<Stock, 'lastPrice' | 'targetPrice'>): number | null {
  if (stock.lastPrice == null || !stock.targetPrice || stock.lastPrice <= 0) return null
  return Math.max(0, stock.targetPrice / stock.lastPrice - 1)
}

/** 기분별로 산 기록의 수익률 — 팔았으면 판 값, 아니면 지금가로 (나중에 '기분별 수익률' 화면) */
export function moodReturns(
  stocks: Stock[],
  entries: StockEntry[],
): { mood: Mood; count: number; rate: number }[] {
  const out = new Map<Mood, { cost: number; gain: number; count: number }>()
  for (const e of entries) {
    if (e.kind !== 'buy' || !e.mood || !e.qty || e.price == null || e.price <= 0) continue
    const s = stocks.find((x) => x.id === e.stockId)
    if (!s || s.lastPrice == null) continue
    const m = out.get(e.mood) ?? { cost: 0, gain: 0, count: 0 }
    m.cost += e.qty * e.price
    m.gain += e.qty * (s.lastPrice - e.price)
    m.count += 1
    out.set(e.mood, m)
  }
  return [...out.entries()].map(([mood, m]) => ({ mood, count: m.count, rate: m.gain / m.cost }))
}

// ── 한 줄 입력: "하이닉스 10주", "애플 3주 180달러", "삼전 5주 팔았어" ──

export interface ParsedLine {
  query: string
  qty: number | null
  price: number | null
  side: 'buy' | 'sell'
}

const KOREAN_UNIT: Record<string, number> = { 천: 1_000, 만: 10_000 }

export function parseStockLine(input: string): ParsedLine {
  const side: 'buy' | 'sell' = /(팔았|매도|팔아|팔기|익절|손절)/.test(input) ? 'sell' : 'buy'
  const s = input
    .replace(/(샀어요|샀어|샀음|샀다|매수|팔았어요|팔았어|팔았음|팔았다|매도|익절|손절)/g, ' ')
    .trim()

  // 'N주' 앞은 종목 이름, 뒤는 가격 — 'KODEX 200 3주'의 200을 가격으로 읽지 않게
  const q = s.match(/(\d+(?:\.\d+)?)\s*주/)
  const qty = q ? Number(q[1]) : null
  const head = q ? s.slice(0, q.index) : s
  const tail = q ? s.slice((q.index ?? 0) + q[0].length) : ''

  // 가격: '18만', '18.5만원', '180달러', '$180', '240,000원', '@240000'
  // 'N주' 뒤에 오면 단위가 없어도 가격, 'N주'가 없으면 단위가 있을 때만
  const PRICE = /(\$|@)?\s*(\d[\d,]*(?:\.\d+)?)\s*(만|천)?\s*(원|달러|불)?/
  let price: number | null = null
  let name = head
  const pt = tail.match(PRICE)
  const ph = q ? null : head.match(PRICE)
  const hit = pt ?? (ph && (ph[1] || ph[3] || ph[4]) ? ph : null)
  if (hit) {
    const n = Number(hit[2].replace(/,/g, ''))
    price = hit[3] ? n * KOREAN_UNIT[hit[3]] : n
    if (!pt) name = head.replace(hit[0], ' ')
  }
  const query = name
    .replace(/[@,]/g, ' ')
    .replace(/(에|에서)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { query, qty, price, side }
}

// ── 종목 찾기 ────────────────────────────────

/** [이름, 코드, 시장] — 시장: P 코스피 · Q 코스닥 · N 코넥스 · E 국내 ETF · U 미국 (scripts/build-stock-list.mjs) */
export type StockListRow = [string, string, 'P' | 'Q' | 'N' | 'E' | 'U']

export interface StockMatch {
  name: string
  code: string
  market: StockMarket
  label: string
}

const MARKET_LABEL: Record<StockListRow[2], string> = {
  P: '코스피',
  Q: '코스닥',
  N: '코넥스',
  E: 'ETF',
  U: '미국',
}

/** 줄임말·별명 → 목록에 있는 이름 */
const ALIASES: Record<string, string> = {
  삼전: '삼성전자',
  하닉: 'SK하이닉스',
  하이닉스: 'SK하이닉스',
  네이버: 'NAVER',
  엔솔: 'LG에너지솔루션',
  삼바: '삼성바이오로직스',
  현차: '현대차',
  셀트: '셀트리온',
  포스코: 'POSCO홀딩스',
  카뱅: '카카오뱅크',
  한화에어로: '한화에어로스페이스',
  구글: '알파벳 A(구글)',
  엔비: '엔비디아',
  마소: '마이크로소프트',
  팔란: '팔란티어',
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')

export function toMatch(row: StockListRow): StockMatch {
  return {
    name: row[0],
    code: row[1],
    market: row[2] === 'U' ? 'US' : 'KR',
    label: MARKET_LABEL[row[2]] + (row[1] && row[2] !== 'U' ? ` · ${row[1]}` : ''),
  }
}

/** 이름·코드·티커로 찾기 — 똑같은 것 > 별명 > 앞부분이 같은 것 > 들어 있는 것 (짧은 이름 먼저) */
export function searchStocks(list: StockListRow[], query: string, limit = 6): StockMatch[] {
  const q = norm(query)
  if (!q) return []
  const alias = ALIASES[q] ? norm(ALIASES[q]) : null
  const scored: { row: StockListRow; score: number }[] = []
  for (const row of list) {
    const name = norm(row[0])
    const code = row[1].toLowerCase()
    let score = -1
    if (name === q || code === q) score = 0
    else if (alias && name === alias) score = 1
    else if (name.startsWith(q) || (code && code.startsWith(q))) score = 2
    else if (name.includes(q)) score = 3
    if (score >= 0) scored.push({ row, score })
  }
  return scored
    .sort((a, b) => a.score - b.score || a.row[0].length - b.row[0].length)
    .slice(0, limit)
    .map((s) => toMatch(s.row))
}

let listCache: Promise<StockListRow[]> | null = null
/** public/stock-list.json — 처음 찾을 때 한 번만 받는다 */
export function loadStockList(): Promise<StockListRow[]> {
  listCache ??= fetch(`${import.meta.env.BASE_URL}stock-list.json`)
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => {
      listCache = null
      return []
    })
  return listCache
}

/** 지금 가격 보러 가기 — 시세를 앱에 보여주는 대신 네이버 증권으로 보낸다 */
export function quoteLink(stock: Pick<Stock, 'market' | 'code' | 'name'>): string {
  if (stock.market === 'KR' && /^[0-9A-Z]{6}$/.test(stock.code)) {
    return `https://m.stock.naver.com/domestic/stock/${stock.code}/total`
  }
  return `https://m.search.naver.com/search.naver?query=${encodeURIComponent(`${stock.name} 주가`)}`
}

/** 원·달러 금액 글자 */
export function money(n: number, currency: 'KRW' | 'USD'): string {
  if (currency === 'USD') {
    return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  }
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}
