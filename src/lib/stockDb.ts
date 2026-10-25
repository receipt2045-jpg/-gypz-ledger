// 주식 일지 저장소 (2026-10-25) — supabase/stock-journal.sql 표 두 개 + stock-photos 버킷.
// 로그인 전 둘러보기(예시 가계부)에선 householdId가 없어서, 같은 모양의 메모리 저장소를 쓴다.
import { supabase } from './supabase'
import type {
  EntryKind,
  Mood,
  PlanKept,
  Stock,
  StockEntry,
  StockMarket,
  StockOwner,
} from './stocks'

const today = () => new Date().toLocaleDateString('sv-SE')
const genId = () => crypto.randomUUID()

// ── 행 ↔ 앱 모양 ─────────────────────────────

function toStock(r: any): Stock {
  return {
    id: r.id,
    owner: r.owner === 'shared' ? 'shared' : (Number(r.owner) as 1 | 2),
    market: r.market,
    code: r.code ?? '',
    exchange: r.exchange ?? '',
    name: r.name,
    currency: r.currency,
    pickReason: r.pick_reason ?? '',
    targetPrice: r.target_price == null ? null : Number(r.target_price),
    stopPrice: r.stop_price == null ? null : Number(r.stop_price),
    sellPlan: r.sell_plan ?? '',
    lastPrice: r.last_price == null ? null : Number(r.last_price),
    lastPriceAt: r.last_price_at ?? null,
    createdAt: r.created_at,
  }
}

function toEntry(r: any): StockEntry {
  return {
    id: r.id,
    stockId: r.stock_id,
    memberNo: r.member_no,
    kind: r.kind,
    qty: r.qty == null ? null : Number(r.qty),
    price: r.price == null ? null : Number(r.price),
    tradedOn: r.traded_on,
    reasons: r.reasons ?? [],
    note: r.note ?? '',
    mood: r.mood ?? null,
    planKept: r.plan_kept ?? null,
    review: r.review ?? '',
    photoPath: r.photo_path ?? null,
    replyTo: r.reply_to ?? null,
    createdAt: r.created_at,
  }
}

const nz = (s: string | undefined) => (s && s.trim() ? s.trim() : null)

export interface NewStock {
  owner: StockOwner
  market: StockMarket
  code: string
  /** 상장한 곳 (stocks.ts exchangeLabel) */
  exchange?: string
  name: string
  lastPrice?: number | null
}

export interface NewEntry {
  stockId: string
  kind: EntryKind
  qty?: number | null
  price?: number | null
  tradedOn?: string
  reasons?: string[]
  note?: string
  mood?: Mood | null
  planKept?: PlanKept | null
  review?: string
  photoPath?: string | null
  replyTo?: string | null
}

export type StockPatch = Partial<
  Pick<Stock, 'pickReason' | 'targetPrice' | 'stopPrice' | 'sellPlan' | 'lastPrice' | 'owner'>
>

export interface StockApi {
  load(): Promise<{ stocks: Stock[]; entries: StockEntry[] }>
  /** 같은 이름·시장 종목이 있으면 그걸 돌려준다 — 캡처를 두 번 올려도 종목이 겹치지 않게 */
  findOrCreate(s: NewStock, existing: Stock[]): Promise<Stock>
  update(id: string, patch: StockPatch): Promise<void>
  removeStock(id: string): Promise<void>
  addEntry(e: NewEntry): Promise<StockEntry>
  removeEntry(id: string): Promise<void>
  uploadPhoto(file: Blob): Promise<string>
  photoUrl(path: string): Promise<string | null>
}

function patchRow(p: StockPatch) {
  return {
    ...(p.pickReason !== undefined ? { pick_reason: nz(p.pickReason) } : {}),
    ...(p.targetPrice !== undefined ? { target_price: p.targetPrice } : {}),
    ...(p.stopPrice !== undefined ? { stop_price: p.stopPrice } : {}),
    ...(p.sellPlan !== undefined ? { sell_plan: nz(p.sellPlan) } : {}),
    ...(p.owner !== undefined ? { owner: String(p.owner) } : {}),
    ...(p.lastPrice !== undefined
      ? {
          last_price: p.lastPrice,
          last_price_at: p.lastPrice == null ? null : new Date().toISOString(),
        }
      : {}),
    updated_at: new Date().toISOString(),
  }
}

const sameStock = (a: Pick<Stock, 'name' | 'market'>, b: Pick<Stock, 'name' | 'market'>) =>
  a.market === b.market && a.name.replace(/\s+/g, '') === b.name.replace(/\s+/g, '')

export function remoteStocks(householdId: string, memberNo: 1 | 2): StockApi {
  return {
    async load() {
      const [s, e] = await Promise.all([
        supabase.from('stocks').select('*').eq('household_id', householdId).order('created_at'),
        supabase
          .from('stock_entries')
          .select('*')
          .eq('household_id', householdId)
          .order('traded_on')
          .order('created_at'),
      ])
      if (s.error) throw s.error
      if (e.error) throw e.error
      return { stocks: (s.data ?? []).map(toStock), entries: (e.data ?? []).map(toEntry) }
    },
    async findOrCreate(n, existing) {
      const found = existing.find((x) => sameStock(x, n))
      if (found) {
        if (n.lastPrice != null) await this.update(found.id, { lastPrice: n.lastPrice })
        return n.lastPrice != null ? { ...found, lastPrice: n.lastPrice } : found
      }
      const { data, error } = await supabase
        .from('stocks')
        .insert({
          household_id: householdId,
          owner: String(n.owner),
          market: n.market,
          code: nz(n.code),
          exchange: nz(n.exchange),
          name: n.name.trim(),
          currency: n.market === 'US' ? 'USD' : 'KRW',
          ...(n.lastPrice != null
            ? { last_price: n.lastPrice, last_price_at: new Date().toISOString() }
            : {}),
        })
        .select('*')
        .single()
      if (error) throw error
      return toStock(data)
    },
    async update(id, patch) {
      const { error } = await supabase.from('stocks').update(patchRow(patch)).eq('id', id)
      if (error) throw error
    },
    async removeStock(id) {
      const { error } = await supabase.from('stocks').delete().eq('id', id)
      if (error) throw error
    },
    async addEntry(n) {
      const { data, error } = await supabase
        .from('stock_entries')
        .insert({
          stock_id: n.stockId,
          household_id: householdId,
          member_no: memberNo,
          kind: n.kind,
          qty: n.qty ?? null,
          price: n.price ?? null,
          traded_on: n.tradedOn ?? today(),
          reasons: n.reasons ?? [],
          note: nz(n.note),
          mood: n.mood ?? null,
          plan_kept: n.planKept ?? null,
          review: nz(n.review),
          photo_path: n.photoPath ?? null,
          reply_to: n.replyTo ?? null,
        })
        .select('*')
        .single()
      if (error) throw error
      return toEntry(data)
    },
    async removeEntry(id) {
      const { error } = await supabase.from('stock_entries').delete().eq('id', id)
      if (error) throw error
    },
    async uploadPhoto(file) {
      const path = `${householdId}/${genId()}.jpg`
      const { error } = await supabase.storage
        .from('stock-photos')
        .upload(path, file, { contentType: 'image/jpeg' })
      if (error) throw error
      return path
    },
    async photoUrl(path) {
      const { data } = await supabase.storage.from('stock-photos').createSignedUrl(path, 3600)
      return data?.signedUrl ?? null
    },
  }
}

/** 둘러보기용 — 서버에 안 가고 화면 안에서만 바뀐다 */
export function localStocks(seed: { stocks: Stock[]; entries: StockEntry[] }): StockApi {
  let stocks = [...seed.stocks]
  let entries = [...seed.entries]
  const photos = new Map<string, string>()
  return {
    async load() {
      return { stocks: [...stocks], entries: [...entries] }
    },
    async findOrCreate(n, existing) {
      const found = existing.find((x) => sameStock(x, n))
      if (found) return found
      const s: Stock = {
        id: genId(),
        owner: n.owner,
        market: n.market,
        code: n.code,
        exchange: n.exchange ?? '',
        name: n.name.trim(),
        currency: n.market === 'US' ? 'USD' : 'KRW',
        pickReason: '',
        targetPrice: null,
        stopPrice: null,
        sellPlan: '',
        lastPrice: n.lastPrice ?? null,
        lastPriceAt: n.lastPrice != null ? new Date().toISOString() : null,
        createdAt: new Date().toISOString(),
      }
      stocks = [...stocks, s]
      return s
    },
    async update(id, patch) {
      stocks = stocks.map((s) => (s.id === id ? { ...s, ...patch } : s))
    },
    async removeStock(id) {
      stocks = stocks.filter((s) => s.id !== id)
      entries = entries.filter((e) => e.stockId !== id)
    },
    async addEntry(n) {
      const e: StockEntry = {
        id: genId(),
        stockId: n.stockId,
        memberNo: 1,
        kind: n.kind,
        qty: n.qty ?? null,
        price: n.price ?? null,
        tradedOn: n.tradedOn ?? today(),
        reasons: n.reasons ?? [],
        note: n.note ?? '',
        mood: n.mood ?? null,
        planKept: n.planKept ?? null,
        review: n.review ?? '',
        photoPath: n.photoPath ?? null,
        replyTo: n.replyTo ?? null,
        createdAt: new Date().toISOString(),
      }
      entries = [...entries, e]
      return e
    },
    async removeEntry(id) {
      entries = entries.filter((e) => e.id !== id && e.replyTo !== id)
    },
    async uploadPhoto(file) {
      const path = `local/${genId()}`
      photos.set(path, URL.createObjectURL(file))
      return path
    },
    async photoUrl(path) {
      return photos.get(path) ?? null
    },
  }
}

// ── 캡처 읽기 (functions/stock-capture) ───────────────

export interface CaptureItem {
  name: string
  code: string
  market: StockMarket
  /** 목록에서 찾았을 때만 (캡처엔 거래소가 잘 안 보인다) */
  exchange?: string
  qty: number
  price: number
  current_price: number
  side: 'buy' | 'sell' | ''
  traded_on: string
  confident: boolean
}

/** 사진을 긴 쪽 1600px JPEG로 줄인다 — 글자는 읽히고, 보내는 양은 작게 */
export async function shrinkImage(file: Blob, max = 1600, quality = 0.85): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('사진을 줄이지 못했어요'))),
      'image/jpeg',
      quality,
    ),
  )
}

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

export class CaptureError extends Error {
  constructor(public reason: 'login' | 'limit' | 'failed') {
    super(reason)
  }
}

export async function readCapture(
  file: Blob,
): Promise<{ screen: 'holdings' | 'trades' | 'unknown'; items: CaptureItem[] }> {
  const image = await toBase64(await shrinkImage(file))
  const { data, error } = await supabase.functions.invoke('stock-capture', {
    body: { image, mediaType: 'image/jpeg' },
  })
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status
    throw new CaptureError(status === 401 ? 'login' : status === 429 ? 'limit' : 'failed')
  }
  return { screen: data?.screen ?? 'unknown', items: (data?.items ?? []) as CaptureItem[] }
}
