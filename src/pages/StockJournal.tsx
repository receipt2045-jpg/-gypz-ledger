import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ExternalLink, ImagePlus, Trash2, X } from 'lucide-react'
import { useLedgerStore } from '../lib/store'
import { shrinkImage } from '../lib/stockDb'
import { markStockSeen, useStocks } from '../lib/useStocks'
import { fmtQty } from './Stocks'
import {
  BUY_REASONS,
  MOODS,
  PLAN_KEPT,
  QUICK_REACTIONS,
  SELL_REASONS,
  money,
  positionOf,
  quoteLink,
  stockTag,
  targetProgress,
  valuationOf,
  type Mood,
  type PlanKept,
  type Stock,
  type StockEntry,
} from '../lib/stocks'

type Side = 'buy' | 'sell' | 'memo'
interface Draft {
  side: 'buy' | 'sell'
  qty: number | null
  price: number | null
}

const shortDate = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`
const num = (s: string) => {
  const n = Number(s.replace(/[^\d.]/g, ''))
  return s.trim() && Number.isFinite(n) ? n : null
}

/**
 * 종목 하나의 매매일지 (2026-10-25) — 결영이네 매매일지 양식 순서 그대로:
 * 손익(지금가) → 종목 선정 사유 → 매도 계획 → 오늘 기록하기 → 기록(매수·매도·메모, 배우자 한 줄).
 */
export default function StockJournal() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const draft = (location.state as { draft?: Draft } | null)?.draft
  const profile = useLedgerStore((s) => s.profile)
  const names: [string, string] = [profile.member1Name, profile.member2Name]
  const { api, stocks, entries, status, reload, me } = useStocks()
  const stock = stocks.find((s) => s.id === id)
  const mine = useMemo(() => entries.filter((e) => e.stockId === id), [entries, id])
  const [composing, setComposing] = useState<Side | null>(draft ? draft.side : null)

  useEffect(() => {
    if (id) markStockSeen(id)
  }, [id, entries.length])

  if (status === 'loading')
    return <p className="py-10 text-center text-[13px] text-cap">불러오는 중…</p>
  if (!stock) {
    return (
      <div className="py-10 text-center">
        <p className="text-[14px] text-sub">종목을 찾지 못했어요</p>
        <button
          onClick={() => navigate('/stocks')}
          className="mt-3 text-[13px] font-bold text-brand"
        >
          주식 일지로
        </button>
      </div>
    )
  }

  const pos = positionOf(mine)
  const val = valuationOf(stock, pos)
  const prog = targetProgress(stock, pos.avgPrice)
  const save = async (patch: Parameters<typeof api.update>[1]) => {
    await api.update(stock.id, patch)
    await reload()
  }
  const roots = mine
    .filter((e) => e.kind !== 'comment')
    .slice()
    .reverse()
  const replies = (eid: string) => mine.filter((e) => e.kind === 'comment' && e.replyTo === eid)

  return (
    <div className="animate-fade-up space-y-3 pb-10 lg:mx-auto lg:max-w-[720px]">
      <button
        onClick={() => navigate('/stocks')}
        className="-ml-1 flex items-center gap-0.5 pt-2 text-[14px] font-semibold text-sub"
      >
        <ChevronLeft size={19} />
        주식 일지
      </button>

      {/* 종목·손익 */}
      <section className="rounded-card bg-card p-5 shadow-card">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="min-w-0 truncate text-[20px] font-extrabold text-ink">{stock.name}</h1>
          {val.pnl != null && (
            <span
              className={`tnum shrink-0 text-[14px] font-bold ${val.pnl >= 0 ? 'text-danger' : 'text-brand'}`}
            >
              {val.pnl >= 0 ? '+' : '−'}
              {money(Math.abs(val.pnl), stock.currency)}
              {val.rate != null && ` (${val.rate >= 0 ? '+' : ''}${(val.rate * 100).toFixed(1)}%)`}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] text-cap">
          {stock.owner === 'shared' ? '함께' : names[stock.owner - 1]} · {stockTag(stock)}
        </p>
        <p className="tnum mt-2 text-[13.5px] text-sub">
          {pos.qty > 0 ? (
            <>
              {fmtQty(pos.qty)}주 · 평균 {money(pos.avgPrice, stock.currency)} · 지금{' '}
              <b className="font-bold text-ink">{money(val.value, stock.currency)}</b>
            </>
          ) : (
            <>
              다 팔았어요 · 실현손익{' '}
              <b className={`font-bold ${pos.realized >= 0 ? 'text-danger' : 'text-brand'}`}>
                {pos.realized >= 0 ? '+' : '−'}
                {money(Math.abs(pos.realized), stock.currency)}
              </b>
            </>
          )}
        </p>
        {pos.qty > 0 && pos.realized !== 0 && (
          <p className="tnum text-[12px] text-cap">
            판 것에서 {pos.realized >= 0 ? '+' : '−'}
            {money(Math.abs(pos.realized), stock.currency)}
          </p>
        )}

        {prog != null && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-brand" style={{ width: `${prog * 100}%` }} />
            </div>
            <div className="tnum mt-1 flex justify-between text-[11px] text-cap">
              <span>
                {stock.stopPrice ? `손절 ${money(stock.stopPrice, stock.currency)}` : '평균단가'}
              </span>
              <span>목표 {money(stock.targetPrice!, stock.currency)}</span>
            </div>
          </div>
        )}

        <LastPrice stock={stock} onSave={(p) => save({ lastPrice: p })} />
      </section>

      {/* 종목 선정 사유 */}
      <TextBlock
        title="종목 선정 사유"
        hint="왜 이 회사인가요? (예: HBM 1등, AI 서버가 늘면 같이 큰다)"
        value={stock.pickReason}
        onSave={(v) => save({ pickReason: v })}
      />

      {/* 매도 계획 */}
      <PlanBlock stock={stock} avg={pos.avgPrice} onSave={save} />

      {/* 오늘 기록하기 */}
      {composing ? (
        <Composer
          key={composing}
          initial={composing}
          draft={draft}
          stock={stock}
          entries={mine}
          onCancel={() => setComposing(null)}
          onUpload={(f) => api.uploadPhoto(f)}
          onSave={async (e) => {
            await api.addEntry({ ...e, stockId: stock.id })
            setComposing(null)
            window.history.replaceState({}, '') // 한 번 쓴 초안은 지운다
            await reload()
          }}
        />
      ) : (
        <button
          onClick={() => setComposing('buy')}
          className="h-12 w-full rounded-btn bg-brand text-[15px] font-bold text-white active:bg-brand-dark"
        >
          + 오늘 기록하기
        </button>
      )}

      {/* 기록 — 최근 것부터 */}
      <section className="space-y-2.5">
        {roots.length === 0 && (
          <p className="py-4 text-center text-[13px] text-cap">아직 기록이 없어요</p>
        )}
        {roots.map((e) => (
          <EntryCard
            key={e.id}
            entry={e}
            stock={stock}
            names={names}
            me={me}
            replies={replies(e.id)}
            photoUrl={api.photoUrl}
            onDelete={async (eid) => {
              await api.removeEntry(eid)
              await reload()
            }}
            onReply={async (text) => {
              await api.addEntry({ stockId: stock.id, kind: 'comment', note: text, replyTo: e.id })
              await reload()
            }}
          />
        ))}
      </section>

      <div className="flex items-center justify-between px-1 pt-2">
        <a
          href={quoteLink(stock)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[12.5px] font-bold text-sub"
        >
          지금 가격 보러 가기 <ExternalLink size={13} />
        </a>
        <button
          onClick={async () => {
            if (!window.confirm(`${stock.name} 일지를 통째로 지울까요? 기록도 같이 지워져요`))
              return
            await api.removeStock(stock.id)
            navigate('/stocks')
          }}
          className="text-[12px] font-bold text-cap"
        >
          종목 지우기
        </button>
      </div>
      <p className="px-1 text-center text-[11.5px] text-cap">
        투자 권유가 아니에요 · 기록을 돕는 도구예요
      </p>
    </div>
  )
}

/** 지금가 — 캡처에서 읽었거나 직접 넣은 값. 누르면 고친다 */
function LastPrice({
  stock,
  onSave,
}: {
  stock: Stock
  onSave: (p: number | null) => Promise<void>
}) {
  const [edit, setEdit] = useState(false)
  const [v, setV] = useState('')
  if (!edit) {
    return (
      <button
        onClick={() => {
          setV(stock.lastPrice ? String(stock.lastPrice) : '')
          setEdit(true)
        }}
        className="mt-3 w-full rounded-btn bg-bg px-3 py-2 text-left text-[12.5px] text-sub"
      >
        {stock.lastPrice != null ? (
          <>
            지금가{' '}
            <b className="tnum font-bold text-ink">{money(stock.lastPrice, stock.currency)}</b>
            {stock.lastPriceAt && ` · ${shortDate(stock.lastPriceAt.slice(0, 10))} 기준`} · 눌러서
            바꾸기
          </>
        ) : (
          '지금가를 넣으면 손익이 보여요 · 누르기'
        )}
      </button>
    )
  }
  return (
    <div className="mt-3 flex gap-2">
      <input
        autoFocus
        inputMode="decimal"
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={stock.currency === 'USD' ? '달러로 (예: 228.5)' : '원으로 (예: 250000)'}
        aria-label="지금가"
        className="tnum min-w-0 flex-1 rounded-btn border border-brand bg-white px-3 py-2 text-[14px] outline-none"
      />
      <button
        onClick={async () => {
          await onSave(num(v))
          setEdit(false)
        }}
        className="shrink-0 rounded-btn bg-brand px-4 text-[13px] font-bold text-white"
      >
        저장
      </button>
    </div>
  )
}

function TextBlock({
  title,
  hint,
  value,
  onSave,
}: {
  title: string
  hint: string
  value: string
  onSave: (v: string) => Promise<void>
}) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <section className="rounded-card bg-card px-4 py-3.5 shadow-card">
      <p className="text-[12.5px] font-bold text-cap">{title}</p>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== value && void onSave(v)}
        rows={2}
        placeholder={hint}
        aria-label={title}
        className="mt-1 w-full resize-none bg-transparent text-[14.5px] leading-relaxed text-ink outline-none placeholder:text-cap"
      />
    </section>
  )
}

function PlanBlock({
  stock,
  avg,
  onSave,
}: {
  stock: Stock
  avg: number
  onSave: (p: {
    targetPrice?: number | null
    stopPrice?: number | null
    sellPlan?: string
  }) => Promise<void>
}) {
  const [target, setTarget] = useState(stock.targetPrice ? String(stock.targetPrice) : '')
  const [stop, setStop] = useState(stock.stopPrice ? String(stock.stopPrice) : '')
  const [plan, setPlan] = useState(stock.sellPlan)
  const pct = (p: number | null) =>
    p != null && avg > 0 ? `${p >= avg ? '+' : ''}${(((p - avg) / avg) * 100).toFixed(0)}%` : ''
  const unit = stock.currency === 'USD' ? '$' : '원'
  return (
    <section className="rounded-card bg-card px-4 py-3.5 shadow-card">
      <p className="text-[12.5px] font-bold text-cap">매도 계획</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {(
          [
            ['목표가', target, setTarget, 'targetPrice'],
            ['손절가 (선택)', stop, setStop, 'stopPrice'],
          ] as const
        ).map(([label, v, set, key]) => (
          <label key={key} className="rounded-btn bg-bg px-3 py-2">
            <span className="flex justify-between text-[11px] text-cap">
              {label}
              <span className={key === 'targetPrice' ? 'text-danger' : 'text-brand'}>
                {pct(num(v))}
              </span>
            </span>
            <span className="flex items-baseline gap-1">
              <input
                inputMode="decimal"
                value={v}
                onChange={(e) => set(e.target.value)}
                onBlur={() => void onSave({ [key]: num(v) })}
                aria-label={label}
                className="tnum w-full bg-transparent text-[15px] font-bold text-ink outline-none"
              />
              <span className="text-[12px] text-cap">{unit}</span>
            </span>
          </label>
        ))}
      </div>
      <input
        value={plan}
        onChange={(e) => setPlan(e.target.value)}
        onBlur={() => plan !== stock.sellPlan && void onSave({ sellPlan: plan })}
        placeholder="어떻게 팔지 한 줄 (예: 30만 되면 반만 팔기)"
        aria-label="매도 계획"
        className="mt-2 w-full rounded-btn bg-bg px-3 py-2 text-[14px] text-ink outline-none placeholder:text-cap"
      />
    </section>
  )
}

/** 오늘 기록하기 — 샀어요 / 팔았어요 / 메모만 */
function Composer({
  initial,
  draft,
  stock,
  entries,
  onCancel,
  onSave,
  onUpload,
}: {
  initial: Side
  draft?: Draft
  stock: Stock
  entries: StockEntry[]
  onCancel: () => void
  onSave: (e: {
    kind: 'buy' | 'sell' | 'memo'
    qty?: number | null
    price?: number | null
    tradedOn: string
    reasons: string[]
    note: string
    mood: Mood | null
    planKept: PlanKept | null
    review: string
    photoPath: string | null
  }) => Promise<void>
  onUpload: (f: Blob) => Promise<string>
}) {
  const today = new Date().toLocaleDateString('sv-SE')
  const [side, setSide] = useState<Side>(initial)
  const [qty, setQty] = useState(draft?.qty != null ? String(draft.qty) : '')
  const [price, setPrice] = useState(
    draft?.price != null
      ? String(draft.price)
      : stock.lastPrice != null
        ? String(stock.lastPrice)
        : '',
  )
  const [date, setDate] = useState(today)
  const [reasons, setReasons] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [mood, setMood] = useState<Mood | null>(null)
  const [kept, setKept] = useState<PlanKept | null>(null)
  const [review, setReview] = useState('')
  const [photo, setPhoto] = useState<{ path: string; preview: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const q = num(qty)
  const p = num(price)
  const before = positionOf(entries)
  const after = positionOf([
    ...entries,
    ...(q && p != null && side !== 'memo'
      ? [
          {
            id: 'draft',
            stockId: stock.id,
            memberNo: 1 as const,
            kind: side,
            qty: q,
            price: p,
            tradedOn: date,
            reasons: [],
            note: '',
            mood: null,
            planKept: null,
            review: '',
            photoPath: null,
            replyTo: null,
            createdAt: new Date().toISOString(),
          },
        ]
      : []),
  ])
  const realizedNow = after.realized - before.realized

  const chips = side === 'sell' ? SELL_REASONS : BUY_REASONS
  const toggle = (r: string) =>
    setReasons((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))

  const submit = async () => {
    if (side !== 'memo' && (!q || p == null)) {
      setError('몇 주, 얼마에를 넣어 주세요')
      return
    }
    if (side === 'sell' && q! > before.qty + 1e-9) {
      setError(`지금 ${fmtQty(before.qty)}주 있어요. 그보다 많이 팔 수 없어요`)
      return
    }
    if (side === 'memo' && !note.trim() && !review.trim() && !photo) {
      setError('한 줄이라도 적어 주세요')
      return
    }
    setBusy(true)
    try {
      await onSave({
        kind: side,
        qty: side === 'memo' ? null : q,
        price: side === 'memo' ? null : p,
        tradedOn: date,
        reasons: side === 'memo' ? [] : reasons,
        note,
        mood: side === 'buy' ? mood : null,
        planKept: side === 'sell' ? kept : null,
        review,
        photoPath: photo?.path ?? null,
      })
    } catch {
      setError('저장하지 못했어요. 다시 눌러 주세요')
      setBusy(false)
    }
  }

  const segTone = {
    buy: 'bg-danger text-white',
    sell: 'bg-brand text-white',
    memo: 'bg-ink text-white',
  }

  return (
    <section className="space-y-3 rounded-card bg-card p-4 shadow-card">
      <div className="flex rounded-btn bg-bg p-1">
        {(['buy', 'sell', 'memo'] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSide(s)
              setReasons([])
              setError('')
            }}
            aria-pressed={side === s}
            className={`flex-1 rounded-[10px] py-2 text-[13.5px] font-bold ${side === s ? segTone[s] : 'text-sub'}`}
          >
            {s === 'buy' ? '샀어요' : s === 'sell' ? '팔았어요' : '메모만'}
          </button>
        ))}
      </div>

      {side !== 'memo' && (
        <>
          <div className="grid grid-cols-[1fr_1.4fr] gap-2">
            <label className="rounded-btn bg-bg px-3 py-2">
              <span className="text-[11px] text-cap">몇 주</span>
              <input
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                aria-label="몇 주"
                className="tnum block w-full bg-transparent text-[17px] font-bold text-ink outline-none"
              />
            </label>
            <label className="rounded-btn bg-bg px-3 py-2">
              <span className="text-[11px] text-cap">
                얼마에 ({stock.currency === 'USD' ? '$' : '원'})
              </span>
              <input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                aria-label="얼마에"
                className="tnum block w-full bg-transparent text-[17px] font-bold text-ink outline-none"
              />
            </label>
          </div>
          {q != null && p != null && (
            <p className="tnum px-1 text-[12.5px] text-sub">
              = {money(q * p, stock.currency)}
              {side === 'buy'
                ? ` · 이제 ${fmtQty(after.qty)}주, 평균 ${money(after.avgPrice, stock.currency)}`
                : ` · ${realizedNow >= 0 ? '+' : '−'}${money(Math.abs(realizedNow), stock.currency)} · ${fmtQty(after.qty)}주 남아요`}
            </p>
          )}
        </>
      )}

      <label className="flex items-center gap-2 px-1 text-[12.5px] text-sub">
        날짜
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value || today)}
          className="tnum rounded-btn border border-line bg-white px-2 py-1 text-[13px] text-ink"
        />
      </label>

      {side !== 'memo' && (
        <div>
          <p className="mb-1.5 px-1 text-[13px] font-bold text-ink">
            {side === 'buy' ? '왜 샀어요?' : '왜 팔았어요?'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((r) => (
              <button
                key={r}
                onClick={() => toggle(r)}
                aria-pressed={reasons.includes(r)}
                className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold ${
                  reasons.includes(r) ? 'bg-ink text-white' : 'bg-bg text-sub'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder={
          side === 'memo' ? '오늘 생각을 적어 두세요' : '직접 쓰기 (예: 실적 발표 좋아서 추가)'
        }
        aria-label="메모"
        className="w-full resize-none rounded-btn bg-bg px-3 py-2 text-[14px] leading-relaxed text-ink outline-none placeholder:text-cap"
      />

      {side === 'buy' && (
        <div>
          <p className="mb-1.5 px-1 text-[13px] font-bold text-ink">지금 기분은?</p>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMood(mood === m.key ? null : m.key)}
                aria-pressed={mood === m.key}
                className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold ${
                  mood === m.key ? 'bg-ink text-white' : 'bg-bg text-sub'
                }`}
              >
                {m.emoji} {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {side === 'sell' && (
        <div>
          <p className="mb-1.5 px-1 text-[13px] font-bold text-ink">처음 정한 목표대로 팔았나요?</p>
          <div className="flex flex-wrap gap-1.5">
            {PLAN_KEPT.map((k) => (
              <button
                key={k.key}
                onClick={() => setKept(kept === k.key ? null : k.key)}
                aria-pressed={kept === k.key}
                className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold ${
                  kept === k.key ? 'bg-ink text-white' : 'bg-bg text-sub'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {side !== 'buy' && (
        <input
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="한줄 평가 (예: 계획대로 반 익절, 나머지는 35만까지)"
          aria-label="한줄 평가"
          className="w-full rounded-btn bg-bg px-3 py-2 text-[14px] text-ink outline-none placeholder:text-cap"
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            const small = await shrinkImage(f, 1600, 0.8)
            const path = await onUpload(small)
            setPhoto({ path, preview: URL.createObjectURL(small) })
          } catch {
            setError('사진을 올리지 못했어요')
          }
        }}
      />
      {photo ? (
        <div className="relative w-24">
          <img src={photo.preview} alt="차트 사진" className="h-24 w-24 rounded-btn object-cover" />
          <button
            onClick={() => setPhoto(null)}
            aria-label="사진 빼기"
            className="absolute -right-2 -top-2 rounded-full bg-ink p-1 text-white"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-1 text-[12.5px] font-bold text-sub"
        >
          <ImagePlus size={15} /> 차트 사진 붙이기
        </button>
      )}

      {error && <p className="px-1 text-[12.5px] font-bold text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="h-12 flex-1 rounded-btn bg-bg text-[14px] font-bold text-sub"
        >
          닫기
        </button>
        <button
          disabled={busy}
          onClick={submit}
          className="h-12 flex-[2] rounded-btn bg-brand text-[15px] font-bold text-white disabled:opacity-50"
        >
          {busy ? '남기는 중…' : '일지에 남기기'}
        </button>
      </div>
    </section>
  )
}

function EntryCard({
  entry: e,
  stock,
  names,
  me,
  replies,
  photoUrl,
  onDelete,
  onReply,
}: {
  entry: StockEntry
  stock: Stock
  names: [string, string]
  me: 1 | 2
  replies: StockEntry[]
  photoUrl: (p: string) => Promise<string | null>
  onDelete: (id: string) => Promise<void>
  onReply: (text: string) => Promise<void>
}) {
  const [replying, setReplying] = useState(false)
  const [text, setText] = useState('')
  const [img, setImg] = useState<string | null>(null)
  const [big, setBig] = useState(false)
  useEffect(() => {
    let live = true
    if (e.photoPath) void photoUrl(e.photoPath).then((u) => live && setImg(u))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 서명 주소는 사진이 바뀔 때만 새로
  }, [e.photoPath])

  const mood = MOODS.find((m) => m.key === e.mood)
  const kept = PLAN_KEPT.find((k) => k.key === e.planKept)
  const action =
    e.kind === 'buy'
      ? `${fmtQty(e.qty ?? 0)}주 샀어요`
      : e.kind === 'sell'
        ? `${fmtQty(e.qty ?? 0)}주 팔았어요`
        : e.kind === 'holding'
          ? `${fmtQty(e.qty ?? 0)}주 갖고 있었어요`
          : '메모'
  const tone = e.kind === 'buy' ? 'text-danger' : e.kind === 'sell' ? 'text-brand' : 'text-sub'

  const send = async (t: string) => {
    if (!t.trim()) return
    await onReply(t.trim())
    setText('')
    setReplying(false)
  }

  return (
    <article className="rounded-card bg-card px-4 py-3.5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] text-cap">
          {shortDate(e.tradedOn)} · {names[e.memberNo - 1]} ·{' '}
          <b className={`font-bold ${tone}`}>{action}</b>
          {e.price != null && e.kind !== 'memo' && (
            <span className="tnum"> @{money(e.price, stock.currency)}</span>
          )}
          {mood && ` · ${mood.emoji} ${mood.label}`}
        </p>
        {e.memberNo === me && (
          <button
            onClick={() => window.confirm('이 기록을 지울까요?') && void onDelete(e.id)}
            aria-label="기록 지우기"
            className="shrink-0 text-cap active:text-danger"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {e.reasons.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {e.reasons.map((r) => (
            <span
              key={r}
              className="rounded-full bg-bg px-2 py-0.5 text-[11.5px] font-bold text-sub"
            >
              {r}
            </span>
          ))}
        </div>
      )}
      {e.note && <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink">“{e.note}”</p>}
      {(kept || e.review) && (
        <p className="mt-1.5 rounded-btn bg-bg px-3 py-2 text-[13px] text-ink">
          {kept && <b className="font-bold">{kept.label}</b>}
          {kept && e.review && ' · '}
          {e.review}
        </p>
      )}
      {img && (
        <>
          <button onClick={() => setBig(true)} className="mt-2 block">
            <img src={img} alt="차트 사진" className="h-28 rounded-btn object-cover" />
          </button>
          {big && (
            <div
              role="dialog"
              onClick={() => setBig(false)}
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
            >
              <img src={img} alt="차트 사진 크게" className="max-h-full max-w-full rounded-btn" />
            </div>
          )}
        </>
      )}

      {/* 배우자 한 줄 */}
      {replies.length > 0 && (
        <div className="mt-2.5 space-y-1.5 border-l-2 border-line pl-3">
          {replies.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-2">
              <p className="text-[13.5px] text-ink">
                <b
                  className={`mr-1 text-[12px] font-bold ${r.memberNo === 1 ? 'text-brand' : 'text-pink-600'}`}
                >
                  {names[r.memberNo - 1]}
                </b>
                {r.note}
              </p>
              {r.memberNo === me && (
                <button
                  onClick={() => void onDelete(r.id)}
                  aria-label="한 줄 지우기"
                  className="shrink-0 text-cap"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {replying ? (
        <div className="mt-2.5 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REACTIONS.map((q) => (
              <button
                key={q}
                onClick={() => void send(q)}
                className="rounded-full bg-bg px-2.5 py-1 text-[12px] font-bold text-sub active:bg-line"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              autoFocus
              value={text}
              onChange={(ev) => setText(ev.target.value)}
              onKeyDown={(ev) => ev.key === 'Enter' && void send(text)}
              placeholder="한 줄 남기기"
              aria-label="한 줄 남기기"
              className="min-w-0 flex-1 rounded-btn bg-bg px-3 py-2 text-[13.5px] outline-none"
            />
            <button
              onClick={() => void send(text)}
              className="shrink-0 rounded-btn bg-ink px-3.5 text-[13px] font-bold text-white"
            >
              남기기
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setReplying(true)}
          className="mt-2 text-[12px] font-bold text-cap active:text-sub"
        >
          💬 한 줄 남기기
        </button>
      )}
    </article>
  )
}
