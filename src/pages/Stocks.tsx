import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react'
import { useLedgerStore } from '../lib/store'
import { useFxRates } from '../lib/fx'
import { abbreviateKRW } from '../lib/format'
import { CaptureError, readCapture, type CaptureItem } from '../lib/stockDb'
import { unseenBySpouse, useStocks } from '../lib/useStocks'
import {
  loadStockList,
  money,
  parseStockLine,
  positionOf,
  searchStocks,
  targetProgress,
  toTargetRate,
  valuationOf,
  type StockListRow,
  type StockMatch,
  type StockOwner,
} from '../lib/stocks'

type Filter = 'all' | 1 | 2

/**
 * 주식 일지 (2026-10-25) — 우리집 보유 목록. 종목을 누르면 그 종목 일지로 간다.
 * 추가는 두 가지: 증권사 화면 캡처 한 장, 또는 '하이닉스 10주' 한 줄.
 * 현재가는 받아 오지 않는다 — 캡처에서 읽었거나 직접 넣은 값만 쓴다(lib/stocks.ts 머리말).
 */
export default function Stocks() {
  const navigate = useNavigate()
  const profile = useLedgerStore((s) => s.profile)
  const names: [string, string] = [profile.member1Name, profile.member2Name]
  const rates = useFxRates()
  const { api, stocks, entries, status, reload, me, sample } = useStocks()
  const [filter, setFilter] = useState<Filter>('all')
  const [mode, setMode] = useState<'none' | 'type' | 'capture'>('none')

  const rows = useMemo(
    () =>
      stocks.map((s) => {
        const mine = entries.filter((e) => e.stockId === s.id)
        const pos = positionOf(mine)
        const val = valuationOf(s, pos)
        const fx = s.currency === 'USD' ? rates.USD : 1
        const firstNote = mine.find(
          (e) => (e.kind === 'buy' || e.kind === 'holding') && e.note,
        )?.note
        return {
          s,
          pos,
          val,
          fx,
          journal: mine.filter((e) => e.kind !== 'comment').length,
          reason: s.pickReason || firstNote || '',
        }
      }),
    [stocks, entries, rates.USD],
  )
  const unseen = useMemo(() => unseenBySpouse(entries, me), [entries, me])

  const visible = rows.filter(
    (r) => filter === 'all' || r.s.owner === filter || r.s.owner === 'shared',
  )
  const holding = visible.filter((r) => r.pos.qty > 0)
  const sold = visible.filter((r) => r.pos.qty === 0 && r.journal > 0)

  const totalValue = holding.reduce((a, r) => a + r.val.value * r.fx, 0)
  const priced = holding.filter((r) => r.val.pnl != null)
  const totalPnl = priced.reduce((a, r) => a + (r.val.pnl ?? 0) * r.fx, 0)
  const pricedCost = priced.reduce((a, r) => a + r.pos.cost * r.fx, 0)

  const ownerName = (o: StockOwner) => (o === 'shared' ? '함께' : names[o - 1])

  return (
    <div className="animate-fade-up space-y-4 lg:mx-auto lg:max-w-[720px]">
      <button
        onClick={() => navigate('/assets')}
        className="-ml-1 flex items-center gap-0.5 pt-2 text-[14px] font-semibold text-sub"
      >
        <ChevronLeft size={19} />
        자산
      </button>
      <header className="px-1">
        <h1 className="text-[20px] font-bold text-ink">주식 일지</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-sub">
          왜 샀는지, 얼마에 팔지 — 부부가 같이 보면서 남겨요
        </p>
      </header>

      {sample && (
        <p className="rounded-btn bg-amber-50 px-3.5 py-2.5 text-[12.5px] font-bold text-amber-700">
          예시 일지예요. 가입하면 우리 부부 주식으로 시작해요
        </p>
      )}

      {/* 우리집 주식 지금 금액 */}
      <div className="rounded-card bg-card p-5 shadow-card">
        <p className="text-[12.5px] font-bold text-cap">우리집 주식 지금 금액</p>
        <p className="tnum mt-1 text-[26px] font-extrabold text-ink">{abbreviateKRW(totalValue)}</p>
        {priced.length > 0 ? (
          <p
            className={`tnum mt-0.5 text-[14px] font-bold ${totalPnl >= 0 ? 'text-danger' : 'text-brand'}`}
          >
            {totalPnl >= 0 ? '+' : '−'}
            {abbreviateKRW(Math.abs(totalPnl))}
            {pricedCost > 0 &&
              ` (${totalPnl >= 0 ? '+' : ''}${((totalPnl / pricedCost) * 100).toFixed(1)}%)`}
            <span className="ml-1 font-medium text-cap">산 가격 대비</span>
          </p>
        ) : (
          holding.length > 0 && (
            <p className="mt-0.5 text-[12.5px] text-cap">
              지금가를 넣으면 손익이 보여요 · 캡처를 올리면 같이 읽어요
            </p>
          )
        )}
        <p className="mt-2 text-[11px] text-cap">
          미국 주식은 오늘 환율로 원화 환산 · 지금가는 캡처·직접 입력 기준
        </p>
      </div>

      <div className="flex gap-1.5">
        {(['all', 1, 2] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${
              filter === f ? 'bg-ink text-white' : 'bg-card text-sub shadow-card'
            }`}
          >
            {f === 'all' ? '함께 보기' : names[f - 1]}
          </button>
        ))}
      </div>

      {/* 추가하기 */}
      {mode === 'none' && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode('capture')}
            className="flex items-center justify-center gap-1.5 rounded-btn bg-brand py-3.5 text-[14px] font-bold text-white active:bg-brand-dark"
          >
            <Camera size={17} /> 캡처로 추가
          </button>
          <button
            onClick={() => setMode('type')}
            className="flex items-center justify-center gap-1.5 rounded-btn bg-card py-3.5 text-[14px] font-bold text-ink shadow-card active:bg-line"
          >
            <Plus size={17} /> 직접 입력
          </button>
        </div>
      )}
      {mode === 'type' && (
        <QuickAdd
          names={names}
          me={me}
          onCancel={() => setMode('none')}
          onPick={async (m, owner, draft) => {
            const s = await api.findOrCreate({ ...m, owner }, stocks)
            navigate(`/stocks/${s.id}`, { state: { draft } })
          }}
        />
      )}
      {mode === 'capture' && (
        <CaptureAdd
          names={names}
          me={me}
          sample={sample}
          onCancel={() => setMode('none')}
          onSave={async (items, owner, screen) => {
            for (const it of items) {
              const s = await api.findOrCreate(
                {
                  owner,
                  market: it.market,
                  code: it.code,
                  name: it.name,
                  lastPrice: it.current_price > 0 ? it.current_price : null,
                },
                stocks,
              )
              const has = entries.some((e) => e.stockId === s.id && e.kind !== 'comment')
              if (screen === 'trades') {
                await api.addEntry({
                  stockId: s.id,
                  kind: it.side === 'sell' ? 'sell' : 'buy',
                  qty: it.qty,
                  price: it.price,
                  tradedOn: /^\d{4}-\d{2}-\d{2}$/.test(it.traded_on) ? it.traded_on : undefined,
                })
              } else if (!has) {
                // 잔고 화면: 처음 넣는 종목만 '원래 갖고 있던 것'으로. 이미 일지가 있으면 지금가만 바꾼다
                await api.addEntry({ stockId: s.id, kind: 'holding', qty: it.qty, price: it.price })
              }
            }
            setMode('none')
            await reload()
          }}
        />
      )}

      {status === 'loading' && (
        <p className="py-6 text-center text-[13px] text-cap">불러오는 중…</p>
      )}
      {status === 'error' && (
        <p className="py-6 text-center text-[13px] text-danger">
          불러오지 못했어요. 잠시 뒤 다시 열어 주세요
        </p>
      )}
      {status === 'ready' && holding.length === 0 && sold.length === 0 && (
        <div className="rounded-card bg-card px-5 py-8 text-center shadow-card">
          <p className="text-[15px] font-bold text-ink">첫 종목을 넣어 볼까요?</p>
          <p className="mt-1 text-[13px] leading-relaxed text-sub">
            증권사 앱 잔고 화면을 캡처해 올리면
            <br />
            종목·수량·평균단가를 한 번에 채워요
          </p>
        </div>
      )}

      <div className="space-y-2.5">
        {holding.map(({ s, pos, val, journal, reason }) => {
          const prog = targetProgress(s, pos.avgPrice)
          const toTarget = toTargetRate(s)
          return (
            <button
              key={s.id}
              onClick={() => navigate(`/stocks/${s.id}`)}
              className="block w-full rounded-card bg-card px-4 py-3.5 text-left shadow-card active:bg-line/40"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[15.5px] font-bold text-ink">
                  {s.name}
                  <OwnerBadge owner={s.owner} label={ownerName(s.owner)} />
                </span>
                <span className="tnum shrink-0 text-[15px] font-bold text-ink">
                  {money(val.value, s.currency)}
                </span>
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[12.5px] text-cap">
                  {fmtQty(pos.qty)}주 · 평균 {money(pos.avgPrice, s.currency)}
                  {reason && ` · ${reason}`}
                </span>
                {val.rate != null && (
                  <span
                    className={`tnum shrink-0 text-[13px] font-bold ${val.rate >= 0 ? 'text-danger' : 'text-brand'}`}
                  >
                    {val.rate >= 0 ? '+' : ''}
                    {(val.rate * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              {prog != null && (
                <>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${prog * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11.5px] text-cap">
                    {toTarget != null && toTarget > 0
                      ? `목표가 ${money(s.targetPrice!, s.currency)}까지 ${(toTarget * 100).toFixed(0)}% 남음`
                      : `목표가 ${money(s.targetPrice!, s.currency)}에 닿았어요`}
                  </p>
                </>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11.5px] font-bold">
                <span className="text-cap">일지 {journal}개</span>
                {unseen[s.id] ? (
                  <span className="rounded-full bg-pink-50 px-2 text-pink-600">
                    새 기록 {unseen[s.id]}
                  </span>
                ) : null}
                {!reason && (
                  <span className="rounded-full bg-amber-50 px-2 text-amber-700">
                    이유 비었어요
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {sold.length > 0 && (
        <details className="rounded-card bg-card px-4 py-3 shadow-card">
          <summary className="cursor-pointer text-[13.5px] font-bold text-sub">
            다 판 종목 {sold.length}개
          </summary>
          <div className="mt-2 divide-y divide-line">
            {sold.map(({ s, pos }) => (
              <button
                key={s.id}
                onClick={() => navigate(`/stocks/${s.id}`)}
                className="flex w-full items-center justify-between py-2.5 text-left"
              >
                <span className="text-[14px] font-bold text-ink">{s.name}</span>
                <span
                  className={`tnum text-[13px] font-bold ${pos.realized >= 0 ? 'text-danger' : 'text-brand'}`}
                >
                  {pos.realized >= 0 ? '+' : '−'}
                  {money(Math.abs(pos.realized), s.currency)}
                </span>
              </button>
            ))}
          </div>
        </details>
      )}

      <p className="px-1 pb-4 text-center text-[11.5px] leading-relaxed text-cap">
        투자 권유가 아니에요 · 기록을 돕는 도구예요
      </p>
    </div>
  )
}

export function fmtQty(q: number) {
  return Number.isInteger(q) ? q.toLocaleString('ko-KR') : String(Math.round(q * 10000) / 10000)
}

function OwnerBadge({ owner, label }: { owner: StockOwner; label: string }) {
  const tone =
    owner === 'shared'
      ? 'bg-line text-sub'
      : owner === 1
        ? 'bg-brand/10 text-brand'
        : 'bg-pink-50 text-pink-600'
  return (
    <span
      className={`ml-1.5 rounded-full px-1.5 py-0.5 align-[2px] text-[10.5px] font-bold ${tone}`}
    >
      {label}
    </span>
  )
}

function OwnerPicker({
  value,
  onChange,
  names,
}: {
  value: StockOwner
  onChange: (o: StockOwner) => void
  names: [string, string]
}) {
  return (
    <div className="flex gap-1.5">
      {([1, 2, 'shared'] as const).map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={`flex-1 rounded-btn py-2 text-[13px] font-bold ${
            value === o ? 'bg-ink text-white' : 'bg-bg text-sub'
          }`}
        >
          {o === 'shared' ? '함께' : names[o - 1]}
        </button>
      ))}
    </div>
  )
}

function useStockList() {
  const [list, setList] = useState<StockListRow[]>([])
  useEffect(() => {
    let live = true
    void loadStockList().then((l) => live && setList(l))
    return () => {
      live = false
    }
  }, [])
  return list
}

/** '하이닉스 10주' 한 줄 → 종목 고르기 → 그 종목 일지에서 나머지(이유·기분) */
function QuickAdd({
  names,
  me,
  onCancel,
  onPick,
}: {
  names: [string, string]
  me: 1 | 2
  onCancel: () => void
  onPick: (
    m: StockMatch,
    owner: StockOwner,
    draft: { side: 'buy' | 'sell'; qty: number | null; price: number | null },
  ) => Promise<void>
}) {
  const list = useStockList()
  const [text, setText] = useState('')
  const [owner, setOwner] = useState<StockOwner>(me)
  const [busy, setBusy] = useState(false)
  const parsed = parseStockLine(text)
  const matches = searchStocks(list, parsed.query)
  const custom: StockMatch | null =
    parsed.query.length >= 2 && !matches.some((m) => m.name === parsed.query)
      ? {
          name: parsed.query,
          code: /^[A-Za-z.]{1,6}$/.test(parsed.query) ? parsed.query.toUpperCase() : '',
          market: /^[A-Za-z.]{1,6}$/.test(parsed.query) ? 'US' : 'KR',
          label: '목록에 없는 이름으로 넣기',
        }
      : null

  const pick = async (m: StockMatch) => {
    setBusy(true)
    try {
      await onPick(m, owner, { side: parsed.side, qty: parsed.qty, price: parsed.price })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-card bg-card p-4 shadow-card">
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="하이닉스 10주 · 애플 3주 180달러"
        className="w-full rounded-btn border border-brand bg-white px-3.5 py-3 text-[15px] text-ink outline-none placeholder:text-cap"
      />
      {(parsed.qty != null || parsed.price != null) && (
        <p className="px-1 text-[12.5px] text-sub">
          {parsed.side === 'sell' ? '팔았어요' : '샀어요'}
          {parsed.qty != null && ` · ${fmtQty(parsed.qty)}주`}
          {parsed.price != null && ` · ${parsed.price.toLocaleString('ko-KR')}`}
        </p>
      )}
      <div>
        <p className="mb-1.5 px-1 text-[12.5px] font-bold text-sub">누구 주식이에요?</p>
        <OwnerPicker value={owner} onChange={setOwner} names={names} />
      </div>
      {parsed.query && (
        <div className="divide-y divide-line rounded-btn border border-line">
          {[...matches, ...(custom ? [custom] : [])].map((m) => (
            <button
              key={`${m.market}-${m.name}`}
              disabled={busy}
              onClick={() => pick(m)}
              className="flex w-full items-center justify-between px-3.5 py-3 text-left active:bg-bg disabled:opacity-50"
            >
              <span>
                <span className="block text-[14.5px] font-bold text-ink">{m.name}</span>
                <span className="block text-[11.5px] text-cap">{m.label}</span>
              </span>
              <ChevronRight size={16} className="text-cap" />
            </button>
          ))}
        </div>
      )}
      <button onClick={onCancel} className="w-full py-1 text-[13px] font-bold text-cap">
        닫기
      </button>
    </div>
  )
}

/** 증권사 화면 캡처 → 읽은 결과 확인 → 한 번에 저장 */
function CaptureAdd({
  names,
  me,
  sample,
  onCancel,
  onSave,
}: {
  names: [string, string]
  me: 1 | 2
  sample: boolean
  onCancel: () => void
  onSave: (items: CaptureItem[], owner: StockOwner, screen: 'holdings' | 'trades') => Promise<void>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const list = useStockList()
  const [state, setState] = useState<'pick' | 'reading' | 'review' | 'saving'>('pick')
  const [error, setError] = useState('')
  const [screen, setScreen] = useState<'holdings' | 'trades'>('holdings')
  const [items, setItems] = useState<(CaptureItem & { on: boolean })[]>([])
  const [owner, setOwner] = useState<StockOwner>(me)

  const read = async (file: File) => {
    setError('')
    setState('reading')
    try {
      const r = await readCapture(file)
      if (r.items.length === 0) {
        setError('주식을 찾지 못했어요. 잔고나 체결 내역 화면을 올려 주세요')
        setState('pick')
        return
      }
      setScreen(r.screen === 'trades' ? 'trades' : 'holdings')
      // 목록에 있는 이름으로 맞춘다 — 캡처마다 이름이 조금씩 달라도 같은 종목으로 쌓이게
      setItems(
        r.items.map((it) => {
          const best = searchStocks(list, it.code || it.name, 1)[0]
          return best &&
            (best.code === it.code || best.name.replace(/\s/g, '') === it.name.replace(/\s/g, ''))
            ? { ...it, name: best.name, code: best.code, market: best.market, on: true }
            : { ...it, on: true }
        }),
      )
      setState('review')
    } catch (err) {
      const reason = err instanceof CaptureError ? err.reason : 'failed'
      setError(
        reason === 'limit'
          ? '오늘은 캡처를 많이 읽었어요. 내일 다시 올려 주세요'
          : reason === 'login'
            ? '로그인하고 쓸 수 있어요'
            : '읽지 못했어요. 잠시 뒤 다시 올려 주세요',
      )
      setState('pick')
    }
  }

  const setItem = (i: number, patch: Partial<CaptureItem & { on: boolean }>) =>
    setItems((prev) => prev.map((it, n) => (n === i ? { ...it, ...patch } : it)))

  const chosen = items.filter((it) => it.on && it.name && it.qty > 0)

  return (
    <div className="space-y-3 rounded-card bg-card p-4 shadow-card">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void read(f)
          e.target.value = ''
        }}
      />
      {(state === 'pick' || state === 'reading') && (
        <div className="py-2 text-center">
          <p className="text-[15px] font-bold text-ink">증권사 앱 화면을 올려 주세요</p>
          <p className="mt-1 text-[12.5px] text-sub">보유 잔고 화면이나 체결 내역 화면</p>
          {sample ? (
            <p className="mt-3 text-[12.5px] font-bold text-amber-700">
              캡처 읽기는 가입하면 쓸 수 있어요
            </p>
          ) : (
            <button
              disabled={state === 'reading'}
              onClick={() => fileRef.current?.click()}
              className="mx-auto mt-3 flex items-center justify-center gap-1.5 rounded-btn bg-brand px-6 py-3 text-[14px] font-bold text-white disabled:opacity-60"
            >
              {state === 'reading' ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> 읽는 중… 10초쯤 걸려요
                </>
              ) : (
                '캡처 고르기'
              )}
            </button>
          )}
          {error && <p className="mt-2 text-[12.5px] font-bold text-danger">{error}</p>}
          <p className="mt-3 text-[11px] leading-relaxed text-cap">
            사진은 읽고 나면 남기지 않아요 · 계좌번호·예수금은 읽지 않아요
          </p>
        </div>
      )}

      {(state === 'review' || state === 'saving') && (
        <>
          <p className="px-1 text-[14px] font-bold text-ink">
            {items.length}종목을 찾았어요
            <span className="ml-1 text-[12px] font-medium text-cap">
              {screen === 'trades' ? '· 체결 내역' : '· 보유 잔고'}
            </span>
          </p>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div
                key={i}
                className={`rounded-btn border px-3 py-2.5 ${it.confident ? 'border-line' : 'border-amber-300 bg-amber-50/40'} ${it.on ? '' : 'opacity-40'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <input
                    value={it.name}
                    onChange={(e) => setItem(i, { name: e.target.value })}
                    aria-label="종목명"
                    className="min-w-0 flex-1 bg-transparent text-[14.5px] font-bold text-ink outline-none"
                  />
                  <button
                    onClick={() => setItem(i, { on: !it.on })}
                    className="shrink-0 text-[12px] font-bold text-cap"
                  >
                    {it.on ? '빼기' : '넣기'}
                  </button>
                </div>
                {!it.confident && (
                  <p className="text-[11.5px] font-bold text-amber-700">
                    흐릿해요 — 숫자를 한 번 봐 주세요
                  </p>
                )}
                <div className="mt-1.5 flex items-center gap-2 text-[12.5px] text-sub">
                  {screen === 'trades' && (
                    <span className={it.side === 'sell' ? 'text-brand' : 'text-danger'}>
                      {it.side === 'sell' ? '팔았어요' : '샀어요'}
                    </span>
                  )}
                  <NumField
                    value={it.qty}
                    onChange={(v) => setItem(i, { qty: v })}
                    suffix="주"
                    label="수량"
                  />
                  <span>·</span>
                  <NumField
                    value={it.price}
                    onChange={(v) => setItem(i, { price: v })}
                    prefix={screen === 'trades' ? '단가' : '평균'}
                    label="가격"
                  />
                </div>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-1.5 px-1 text-[12.5px] font-bold text-sub">누구 주식이에요?</p>
            <OwnerPicker value={owner} onChange={setOwner} names={names} />
          </div>
          <button
            disabled={state === 'saving' || chosen.length === 0}
            onClick={async () => {
              setState('saving')
              try {
                await onSave(chosen, owner, screen)
              } catch {
                setError('저장하지 못했어요. 다시 눌러 주세요')
                setState('review')
              }
            }}
            className="h-12 w-full rounded-btn bg-brand text-[15px] font-bold text-white disabled:opacity-50"
          >
            {state === 'saving' ? '저장하는 중…' : `${chosen.length}종목 저장`}
          </button>
          {error && <p className="text-center text-[12.5px] font-bold text-danger">{error}</p>}
          <p className="text-center text-[11.5px] text-cap">숫자는 눌러서 고칠 수 있어요</p>
        </>
      )}
      <button onClick={onCancel} className="w-full py-1 text-[13px] font-bold text-cap">
        닫기
      </button>
    </div>
  )
}

function NumField({
  value,
  onChange,
  prefix,
  suffix,
  label,
}: {
  value: number
  onChange: (v: number) => void
  prefix?: string
  suffix?: string
  label: string
}) {
  return (
    <label className="flex items-center gap-1">
      {prefix && <span>{prefix}</span>}
      <input
        inputMode="decimal"
        aria-label={label}
        value={value ? String(value) : ''}
        onChange={(e) => onChange(Number(e.target.value.replace(/[^\d.]/g, '')) || 0)}
        className="tnum w-20 rounded border border-line bg-white px-1.5 py-0.5 text-right text-[13px] font-bold text-ink outline-none focus:border-brand"
      />
      {suffix && <span>{suffix}</span>}
    </label>
  )
}
