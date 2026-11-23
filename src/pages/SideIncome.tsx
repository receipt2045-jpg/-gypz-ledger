import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import AmountInput from '../components/AmountInput'
import PcColumns from '../components/PcColumns'
import SideGrid from '../components/SideGrid'
import { useLedgerStore } from '../lib/store'
import { useSideIncome } from '../lib/useSideIncome'
import { displayYm, resolveSnapshot } from '../lib/carryover'
import { abbreviateKRW, currentYm, formatWon, formatYmKorean, shiftYm } from '../lib/format'
import {
  allocatedTotal,
  livingSplit,
  savedAmount,
  SIDE_CATEGORIES,
  SIDE_KINDS,
  SIDE_KIND_LABEL,
  summarizeSide,
  yearSide,
  ymOfDate,
  type SideAllocation,
  type SideIncome as SideEntry,
  type SideKind,
  type SideSettlement,
} from '../lib/sideIncome'
import type { NewSideIncome } from '../lib/sideDb'

/** 3억 9,510만원 → 3억 9,510만 (칸이 좁은 곳) */
const short = (n: number) => abbreviateKRW(n).replace(/원$/, '')

const CASH = 'text-emerald-600'
const SAVE = 'text-brand'
const SPENT = 'text-rose-600'
/** 구분마다 글자색 */
const TONE = { cash: CASH, saved: SAVE, spent: SPENT } as const

/**
 * 부수입 가계부 (2026-11-19) — 하단 '부수입' 탭.
 * 살림 가계부와 따로 적고 따로 정산한다. 들어온 돈 / 아낀 돈 두 칸.
 * 월말 부수입 정산에서 들어온 돈을 자산 통장이나 살림(그 달 가계부 '부수입')으로 보낸다.
 */
export default function SideIncome() {
  const { profile } = useLedgerStore()
  const side = useSideIncome()
  const [ym, setYm] = useState(currentYm())
  const [writing, setWriting] = useState(false)
  // 기록 보기 — 표(엑셀처럼 바로 쓰기, 2026-11-23) / 목록. 고른 걸 이 기기에 기억한다
  const [view, setViewState] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem('moabuli.side.view') === 'list' ? 'list' : 'grid'
    } catch {
      return 'grid'
    }
  })
  const setView = (v: 'grid' | 'list') => {
    setViewState(v)
    try {
      localStorage.setItem('moabuli.side.view', v)
    } catch {
      /* 기억 못 해도 그대로 */
    }
  }
  const [editing, setEditing] = useState<string | null>(null)
  const [settling, setSettling] = useState(false)
  const names: [string, string] = [profile.member1Name, profile.member2Name]

  const s = useMemo(() => summarizeSide(side.entries, ym), [side.entries, ym])
  const year = useMemo(() => yearSide(side.entries, ym), [side.entries, ym])
  const monthAll = side.entries
    .filter((e) => ymOfDate(e.earnedOn) === ym)
    .sort((a, b) =>
      a.earnedOn === b.earnedOn
        ? a.createdAt < b.createdAt
          ? 1
          : -1
        : a.earnedOn < b.earnedOn
          ? 1
          : -1,
    )
  // 종류 하나만 보기 (2026-11-23 결영 요청: "카테고리 선택하면 그것만 총액") — '구분|종류'
  const [cat, setCat] = useState<string | null>(null)
  const catKey = (e: { kind: SideKind; category: string }) => `${e.kind}|${e.category}`
  const month = cat ? monthAll.filter((e) => catKey(e) === cat) : monthAll
  // 이 달에 있는 종류 — 금액 큰 순
  const monthCats = SIDE_KINDS.flatMap((k) =>
    s.byCategory[k].map((c) => ({ key: `${k}|${c.category}`, kind: k, ...c })),
  ).sort((a, b) => b.amount - a.amount)
  const picked = cat
    ? (() => {
        const [kind, category] = cat.split('|') as [SideKind, string]
        const sum = (list: SideEntry[]) => list.reduce((a, e) => a + e.amount, 0)
        const inYear = side.entries.filter(
          (e) =>
            catKey(e) === cat &&
            ymOfDate(e.earnedOn).slice(0, 4) === ym.slice(0, 4) &&
            ymOfDate(e.earnedOn) <= ym,
        )
        return { kind, category, month: sum(month), count: month.length, year: sum(inYear) }
      })()
    : null
  const pickCat = (key: string | null) => {
    setCat(key)
    if (key)
      document
        .getElementById('side-records')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const settled = side.settles.find((x) => x.ym === ym)
  const label = formatYmKorean(ym).split(' ')[1]
  const whoLabel = (e: SideEntry) => (e.shared ? '공동' : names[e.memberNo - 1])

  const summary = (
    <div className="rounded-card bg-card px-5 py-4 shadow-card">
      <p className="text-[13px] font-medium text-cap">{formatYmKorean(ym)} 부수입</p>
      <p className="tnum mt-0.5 text-[28px] font-extrabold tracking-tight text-ink">
        {formatWon(s.total)}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        <div className="rounded-btn bg-emerald-50 px-2.5 py-2.5">
          <p className="text-[12px] font-bold text-emerald-700">번 돈</p>
          <p className="tnum whitespace-nowrap text-[14px] font-extrabold tracking-tight text-emerald-700">{formatWon(s.cash)}</p>
        </div>
        <div className="rounded-btn bg-brand/10 px-2.5 py-2.5">
          <p className="text-[12px] font-bold text-brand">아낀 돈</p>
          <p className="tnum whitespace-nowrap text-[14px] font-extrabold tracking-tight text-brand">{formatWon(s.saved)}</p>
        </div>
        <div className="rounded-btn bg-rose-50 px-2.5 py-2.5">
          <p className="text-[12px] font-bold text-rose-600">쓴 돈</p>
          <p className="tnum whitespace-nowrap text-[14px] font-extrabold tracking-tight text-rose-600">{formatWon(s.spent)}</p>
        </div>
      </div>
      {s.spent > 0 && (
        <p className="tnum mt-2 text-[12.5px] text-sub">
          번 돈 − 쓴 돈 = 남은 돈{' '}
          <b className={s.net < 0 ? 'text-danger' : 'text-ink'}>{formatWon(s.net)}</b>
        </p>
      )}
      {s.total > 0 && s.byWho[1] >= 0 && s.byWho[2] >= 0 && s.byWho.shared >= 0 && (
        <div className="mt-3">
          <div className="flex h-2 overflow-hidden rounded-full bg-bg">
            {([1, 2, 'shared'] as const).map((k) => (
              <div
                key={k}
                style={{ width: `${(s.byWho[k] / s.total) * 100}%` }}
                className={k === 1 ? 'bg-brand' : k === 2 ? 'bg-pink-400' : 'bg-line'}
              />
            ))}
          </div>
          <p className="tnum mt-1.5 flex flex-wrap gap-x-3 text-[12px] text-sub">
            <span>
              {names[0]} <b className="text-ink">{formatWon(s.byWho[1])}</b>
            </span>
            <span>
              {names[1]} <b className="text-ink">{formatWon(s.byWho[2])}</b>
            </span>
            {s.byWho.shared > 0 && (
              <span>
                공동 <b className="text-ink">{formatWon(s.byWho.shared)}</b>
              </span>
            )}
          </p>
        </div>
      )}
      <p className="mt-3 border-t border-line pt-2.5 text-[12px] text-cap">
        올해 번 돈 <b className="tnum text-sub">{formatWon(year.cash)}</b> · 아낀 돈{' '}
        <b className="tnum text-sub">{formatWon(year.saved)}</b>
        {year.spent > 0 && (
          <>
            {' '}
            · 쓴 돈 <b className="tnum text-sub">{formatWon(year.spent)}</b>
          </>
        )}
      </p>
    </div>
  )

  const settleBox = settled ? (
    <SettledCard
      ym={ym}
      settle={settled}
      onUndo={async () => {
        if (!window.confirm(`${label} 부수입 마감을 풀까요? 보낸 돈을 자산·가계부에서 다시 빼요.`))
          return
        await side.unsettle(ym)
      }}
    />
  ) : settling ? (
    <SettleCard
      ym={ym}
      entries={side.entries}
      cash={Math.max(0, s.net)}
      me={side.me}
      onCancel={() => setSettling(false)}
      onDone={async (allocs) => {
        await side.settle(ym, allocs)
        setSettling(false)
      }}
    />
  ) : (
    <button
      onClick={() => setSettling(true)}
      className="h-12 w-full rounded-btn bg-ink text-[14px] font-bold text-white active:opacity-90"
    >
      {label} 부수입 정산하기
    </button>
  )

  const list = (
    <div className="space-y-3">
      {SIDE_KINDS.map((k) =>
        s.byCategory[k].length === 0 ? null : (
          <div key={k} className="rounded-card bg-card px-5 py-4 shadow-card">
            <div className="mb-1 flex items-baseline justify-between">
              <p className={`text-[14px] font-bold ${TONE[k]}`}>{SIDE_KIND_LABEL[k]}</p>
              <p className={`tnum text-[14px] font-bold ${TONE[k]}`}>{formatWon(s[k])}</p>
            </div>
            <div className="divide-y divide-line/70">
              {s.byCategory[k].map((c) => (
                <button
                  key={c.category}
                  onClick={() => pickCat(`${k}|${c.category}`)}
                  aria-label={`${c.category}만 보기`}
                  className="-mx-1 flex w-[calc(100%+0.5rem)] justify-between rounded px-1 py-2 text-left text-[13.5px] active:bg-bg"
                >
                  <span className="text-ink">{c.category}</span>
                  <span className="tnum font-semibold text-ink">{formatWon(c.amount)}</span>
                </button>
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  )

  // 이 달 기록 — 표가 넓어서 두 칸으로 나누지 않고 한 줄 전체를 쓴다
  const records = (
    <div id="side-records" className="scroll-mt-4 rounded-card bg-card px-5 py-4 shadow-card">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[14px] font-bold text-ink">
          {label} 기록{' '}
          <span className="text-[12px] font-medium text-cap">
            {view === 'grid' ? '칸에 바로 써요' : '눌러서 고쳐요'}
          </span>
        </p>
        <div className="flex shrink-0 gap-0.5 rounded-full bg-bg p-0.5" role="tablist">
          {(['grid', 'list'] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-full px-3 py-1 text-[12px] font-bold ${
                view === v ? 'bg-white text-ink shadow-card' : 'text-sub'
              }`}
            >
              {v === 'grid' ? '표' : '목록'}
            </button>
          ))}
        </div>
      </div>
      {/* 종류 하나만 보기 — 고르면 그 종류 합계와 그 기록만 */}
      {monthCats.length > 1 && (
        <div className="no-scrollbar -mx-5 mb-2 flex gap-1.5 overflow-x-auto px-5 pb-0.5">
          {[null, ...monthCats].map((c) => (
            <button
              key={c?.key ?? 'all'}
              onClick={() => pickCat(c && cat !== c.key ? c.key : null)}
              aria-pressed={cat === (c?.key ?? null)}
              className={`shrink-0 rounded-full px-3 py-1 text-[12.5px] font-bold ${
                cat === (c?.key ?? null)
                  ? 'bg-ink text-white'
                  : `bg-bg active:bg-line ${c ? TONE[c.kind] : 'text-sub'}`
              }`}
            >
              {c ? c.category : '전체'}
            </button>
          ))}
        </div>
      )}
      {picked && (
        <div className="mb-3 rounded-btn bg-bg px-3.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-bold text-ink">
              {picked.category}{' '}
              <span className={`text-[12px] ${TONE[picked.kind]}`}>
                {SIDE_KIND_LABEL[picked.kind]}
              </span>
            </p>
            <button
              onClick={() => pickCat(null)}
              className="text-[12px] font-bold text-sub active:text-ink"
            >
              전체 보기
            </button>
          </div>
          <p className={`tnum mt-0.5 text-[20px] font-extrabold ${TONE[picked.kind]}`}>
            {formatWon(picked.month)}
          </p>
          <p className="tnum text-[12px] text-sub">
            {label} {picked.count}건 · 올해 {formatWon(picked.year)}
          </p>
        </div>
      )}
      {view === 'grid' ? (
        <SideGrid
          ym={ym}
          preset={picked ? { kind: picked.kind, category: picked.category } : undefined}
          entries={[...month].reverse()}
          names={names}
          me={side.me}
          onAdd={side.add}
          onUpdate={side.update}
          onRemove={side.remove}
        />
      ) : month.length === 0 ? (
        <p className="py-3 text-[13px] text-sub">
          앱테크로 번 돈, 체험단으로 아낀 돈을 적어 보세요
        </p>
      ) : (
        <div className="divide-y divide-line/70">
          {month.map((e) =>
            editing === e.id ? (
              <SideForm
                key={e.id}
                initial={e}
                ym={ym}
                me={side.me}
                names={names}
                onCancel={() => setEditing(null)}
                onSave={async (n) => {
                  await side.update(e.id, n)
                  setEditing(null)
                }}
              />
            ) : (
              <div
                key={e.id}
                onClick={() => setEditing(e.id)}
                className="-mx-1 flex cursor-pointer items-center gap-2 rounded px-1 py-2.5 active:bg-bg"
              >
                <span className="tnum w-9 shrink-0 text-[11.5px] text-cap">
                  {Number(e.earnedOn.slice(5, 7))}/{Number(e.earnedOn.slice(8, 10))}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                  {e.category}
                  <span className="text-cap">
                    {' '}
                    · {whoLabel(e)}
                    {e.note ? ` · ${e.note}` : ''}
                  </span>
                </span>
                <span className={`tnum shrink-0 text-[13.5px] font-bold ${TONE[e.kind]}`}>
                  {e.kind === 'cash' ? '+' : e.kind === 'spent' ? '−' : ''}
                  {formatWon(e.amount)}
                </span>
                <button
                  aria-label={`${e.category} 고치기`}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    setEditing(e.id)
                  }}
                  className="shrink-0 text-cap active:text-brand"
                >
                  <Pencil size={14} />
                </button>
                <button
                  aria-label={`${e.category} 지우기`}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    void side.remove(e.id)
                  }}
                  className="shrink-0 text-cap active:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="animate-fade-up space-y-4 pb-6">
      {/* 달 고르기 */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <button
          onClick={() => setYm(shiftYm(ym, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-sub active:bg-line"
          aria-label="이전 달"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="min-w-[128px] text-center text-[18px] font-bold text-ink">
          {formatYmKorean(ym)}
        </h1>
        <button
          onClick={() => setYm(shiftYm(ym, 1))}
          disabled={ym >= currentYm()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-sub active:bg-line disabled:opacity-25"
          aria-label="다음 달"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {side.status === 'error' && (
        <p className="rounded-btn bg-danger/10 px-3 py-2 text-[13px] font-semibold text-danger">
          부수입 기록을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
        </p>
      )}

      {/* 적기 — 맨 위에서 바로 */}
      {writing ? (
        <div className="rounded-card bg-card px-4 py-4 shadow-card">
          <SideForm
            ym={ym}
            me={side.me}
            names={names}
            onCancel={() => setWriting(false)}
            onSave={async (n) => {
              await side.add(n)
              setWriting(false)
            }}
          />
        </div>
      ) : (
        <button
          onClick={() => setWriting(true)}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-btn bg-brand text-[15px] font-bold text-white shadow-cta active:bg-brand-dark"
        >
          <Plus size={18} /> 부수입 적기
        </button>
      )}

      {records}

      <PcColumns
        left={
          <>
            {summary}
            {settleBox}
          </>
        }
        right={list}
      />
    </div>
  )
}

/** 부수입 적기·고치기 */
function SideForm({
  initial,
  ym,
  me,
  names,
  onSave,
  onCancel,
}: {
  initial?: SideEntry
  ym: string
  me: 1 | 2
  names: [string, string]
  onSave: (n: NewSideIncome) => Promise<void>
  onCancel: () => void
}) {
  const today = new Date().toLocaleDateString('sv-SE')
  const [kind, setKind] = useState<SideKind>(initial?.kind ?? 'cash')
  // 목록에 없는 종류로 적었던 기록은 '직접' 칸에 그 이름을 넣어서 연다
  const initCustom =
    initial && !SIDE_CATEGORIES[initial.kind].includes(initial.category) ? initial.category : ''
  const [category, setCategory] = useState(
    initCustom ? '직접' : (initial?.category ?? SIDE_CATEGORIES.cash[0]),
  )
  const [custom, setCustom] = useState(initCustom)
  const [amount, setAmount] = useState(initial && initial.kind !== 'saved' ? initial.amount : 0)
  const [repeat, setRepeat] = useState(initial?.repeat ?? false)
  const [price, setPrice] = useState(
    initial?.kind === 'saved' ? (initial.price ?? initial.amount) : 0,
  )
  const [paid, setPaid] = useState(initial?.paid ?? 0)
  const [who, setWho] = useState<1 | 2 | 'shared'>(
    initial ? (initial.shared ? 'shared' : initial.memberNo) : me,
  )
  const [date, setDate] = useState(initial?.earnedOn ?? (today.startsWith(ym) ? today : `${ym}-01`))
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const cats = SIDE_CATEGORIES[kind]
  const isCustom = category === '직접'
  const value = kind === 'saved' ? savedAmount(price, paid) : amount

  const pickKind = (k: SideKind) => {
    setKind(k)
    if (category !== '직접' && !SIDE_CATEGORIES[k].includes(category))
      setCategory(SIDE_CATEGORIES[k][0])
  }

  const submit = async () => {
    const cat = isCustom ? custom.trim() : category
    if (!cat) return setError('종류를 골라 주세요')
    if (value <= 0)
      return setError(
        kind === 'cash'
          ? '번 금액을 넣어 주세요'
          : kind === 'spent'
            ? '쓴 금액을 넣어 주세요'
            : '얼마짜리였는지 넣어 주세요',
      )
    setSaving(true)
    try {
      await onSave({
        kind,
        category: cat,
        amount: value,
        price: kind === 'saved' ? price : undefined,
        paid: kind === 'saved' && paid > 0 ? paid : undefined,
        memberNo: who === 'shared' ? me : who,
        shared: who === 'shared' ? true : undefined,
        earnedOn: date,
        note: note.trim() || undefined,
        repeat: repeat || undefined,
      })
    } catch {
      setError('저장하지 못했어요. 잠시 뒤 다시 눌러 주세요')
      setSaving(false)
    }
  }

  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-[13px] font-semibold ${on ? 'bg-ink text-white' : 'bg-bg text-sub active:bg-line'}`

  return (
    <div className="space-y-3 py-1">
      <div className="flex gap-1 rounded-btn bg-line/60 p-1" role="tablist">
        {SIDE_KINDS.map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            onClick={() => pickKind(k)}
            className={`flex-1 rounded-[10px] py-2 text-[14px] font-semibold ${
              kind === k ? 'bg-white text-ink shadow-card' : 'text-sub'
            }`}
          >
            {SIDE_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-cap">
        {kind === 'cash'
          ? '통장에 실제로 들어온 돈 — 정산 때 어디로 보낼지 정해요'
          : kind === 'saved'
            ? '체험단·포인트처럼 안 나간 돈 — 기록으로 모아요'
            : '부수입 때문에 나간 돈 — 번 돈에서 빼서 남은 돈을 보여 줘요'}
      </p>

      <div>
        <p className="mb-1.5 text-[12.5px] font-bold text-sub">
          {kind === 'cash'
            ? '무엇으로 벌었나요'
            : kind === 'saved'
              ? '무엇으로 아꼈나요'
              : '어디에 썼나요'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[...cats, '직접'].map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={chip(category === c)}>
              {c === '직접' ? '+ 직접' : c}
            </button>
          ))}
        </div>
        {isCustom && (
          <input
            aria-label="직접 적기"
            value={custom}
            maxLength={30}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="예: 설문 조사"
            className="mt-2 w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] outline-none focus:border-brand"
          />
        )}
      </div>

      {kind !== 'saved' ? (
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-bold text-sub">
            {kind === 'cash' ? '번 금액' : '쓴 금액'}
          </span>
          <AmountInput value={amount} onChange={setAmount} />
        </label>
      ) : (
        <>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold text-sub">
              얼마짜리였나요 <span className="font-medium text-cap">원래 냈어야 할 돈</span>
            </span>
            <AmountInput value={price} onChange={setPrice} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12.5px] font-bold text-sub">
              내가 낸 돈 <span className="font-medium text-cap">있으면</span>
            </span>
            <AmountInput value={paid} onChange={setPaid} />
          </label>
          {price > 0 && (
            <p className="rounded-btn bg-brand/10 px-3 py-2 text-[13px] font-bold text-brand">
              아낀 돈 {formatWon(value)}으로 적어요
            </p>
          )}
        </>
      )}

      {/* 매달 — 구독처럼 다달이 나가거나 들어오는 건 다음 달부터 저절로 적는다 (2026-11-23) */}
      <label className="flex items-center justify-between rounded-btn bg-bg px-3 py-2.5">
        <span>
          <span className="block text-[13px] font-bold text-ink">
            매달 {kind === 'spent' ? '나가요' : '들어와요'}
          </span>
          <span className="block text-[11.5px] text-cap">
            켜 두면 다음 달 같은 날에 저절로 적어요 · 끄면 멈춰요
          </span>
        </span>
        <input
          type="checkbox"
          checked={repeat}
          onChange={(e) => setRepeat(e.target.checked)}
          aria-label="매달"
          className="h-5 w-5 accent-[#3182F6]"
        />
      </label>

      <div>
        <p className="mb-1.5 text-[12.5px] font-bold text-sub">누가</p>
        <div className="flex gap-1.5">
          {([1, 2, 'shared'] as const).map((w) => (
            <button key={w} onClick={() => setWho(w)} className={chip(who === w)}>
              {w === 'shared' ? '공동' : names[w - 1]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <label className="flex-1">
          <span className="mb-1.5 block text-[12.5px] font-bold text-sub">날짜</span>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] outline-none focus:border-brand"
          />
        </label>
        <label className="flex-[1.4]">
          <span className="mb-1.5 block text-[12.5px] font-bold text-sub">메모</span>
          <input
            value={note}
            maxLength={100}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 성수 파스타"
            className="w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] outline-none focus:border-brand"
          />
        </label>
      </div>

      {error && <p className="text-[13px] font-semibold text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="h-11 flex-1 rounded-btn bg-bg text-[14px] font-semibold text-sub active:bg-line"
        >
          취소
        </button>
        <button
          onClick={() => void submit()}
          disabled={saving}
          className="h-11 flex-[2] rounded-btn bg-brand text-[14px] font-bold text-white active:bg-brand-dark disabled:opacity-50"
        >
          {initial ? '저장' : '적기'}
        </button>
      </div>
    </div>
  )
}

/** 부수입 정산 — 들어온 돈을 어디로 보낼지 */
function SettleCard({
  ym,
  entries,
  cash,
  me,
  onCancel,
  onDone,
}: {
  ym: string
  entries: SideEntry[]
  cash: number
  me: 1 | 2
  onCancel: () => void
  onDone: (allocs: SideAllocation[]) => Promise<void>
}) {
  const snapshots = useLedgerStore((st) => st.snapshots)
  const accounts = resolveSnapshot(snapshots, displayYm(snapshots)).items.filter(
    (it) => it.kind === 'asset' && it.group !== 'realestate' && it.group !== 'consumable',
  )
  const [amounts, setAmounts] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const label = formatYmKorean(ym).split(' ')[1]
  const living = amounts.living ?? 0
  const sent = Object.values(amounts).reduce((a, b) => a + b, 0)
  const left = cash - sent
  const set = (k: string, v: number) => setAmounts((p) => ({ ...p, [k]: v }))

  const finish = async () => {
    if (left < 0) return
    const allocs: SideAllocation[] = [
      ...accounts
        .filter((a) => (amounts[a.id] ?? 0) > 0)
        .map<SideAllocation>((a) => ({
          to: 'asset',
          assetId: a.id,
          assetName: a.name,
          amount: amounts[a.id],
        })),
      ...(living > 0
        ? [{ to: 'living' as const, amount: living, split: livingSplit(entries, ym, living, me) }]
        : []),
    ]
    setSaving(true)
    try {
      await onDone(allocs)
    } finally {
      setSaving(false)
    }
  }

  const row = (key: string, title: string, sub: string) => (
    <div key={key} className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-bold text-ink">{title}</p>
        <p className="truncate text-[11.5px] text-cap">{sub}</p>
      </div>
      <label className="w-[46%] shrink-0">
        <span className="sr-only">{title}에 보낼 돈</span>
        <AmountInput value={amounts[key] ?? 0} onChange={(v) => set(key, v)} />
      </label>
    </div>
  )

  return (
    <div className="rounded-card bg-card px-5 py-4 shadow-card">
      <p className="text-[15px] font-bold text-ink">{label} 부수입 정산</p>
      <p className="mt-0.5 text-[13px] text-sub">
        {label}에 번 돈(쓴 돈 빼고) <b className="tnum text-emerald-600">{formatWon(cash)}</b>,
        어디로 보낼까요
      </p>
      <div className="mt-2 divide-y divide-line/70">
        {accounts.map((a) =>
          row(a.id, a.name, `자산 · ${a.owner ?? '공동'} · 지금 ${short(a.amount)}`),
        )}
        {row('living', '살림에 보태기', `가계부 ${label} '부수입'에 더해요`)}
      </div>
      {accounts.length === 0 && (
        <p className="mt-1 text-[12px] text-cap">
          자산 탭에 통장·투자를 등록하면 여기서 바로 보낼 수 있어요
        </p>
      )}
      <p
        className={`tnum mt-2 text-right text-[13px] font-bold ${left < 0 ? 'text-danger' : 'text-sub'}`}
      >
        {left < 0 ? `번 돈보다 ${formatWon(-left)} 많아요` : `안 보낸 돈 ${formatWon(left)}`}
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={onCancel}
          className="h-11 flex-1 rounded-btn bg-bg text-[14px] font-semibold text-sub active:bg-line"
        >
          취소
        </button>
        <button
          onClick={() => void finish()}
          disabled={saving || left < 0}
          className="h-11 flex-[2] rounded-btn bg-ink text-[14px] font-bold text-white active:opacity-90 disabled:opacity-40"
        >
          {label} 부수입 마감
        </button>
      </div>
    </div>
  )
}

/** 마감한 달 — 어디로 보냈는지 */
function SettledCard({
  ym,
  settle,
  onUndo,
}: {
  ym: string
  settle: SideSettlement
  onUndo: () => void
}) {
  const label = formatYmKorean(ym).split(' ')[1]
  const total = allocatedTotal(settle.allocations)
  return (
    <div className="rounded-card bg-card px-5 py-4 shadow-card">
      <p className="text-[15px] font-bold text-ink">{label} 부수입 마감 ✅</p>
      {settle.allocations.length === 0 ? (
        <p className="mt-1 text-[13px] text-sub">보낸 곳 없이 마감했어요</p>
      ) : (
        <div className="mt-1.5 divide-y divide-line/70">
          {settle.allocations.map((a, i) => (
            <div key={i} className="flex justify-between py-1.5 text-[13.5px]">
              <span className="text-ink">
                {a.to === 'asset' ? a.assetName : `살림에 보태기 · 가계부 '부수입'`}
              </span>
              <span className="tnum font-bold text-ink">{formatWon(a.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between py-1.5 text-[13px] font-bold text-sub">
            <span>보낸 돈</span>
            <span className="tnum">{formatWon(total)}</span>
          </div>
        </div>
      )}
      <button
        onClick={onUndo}
        className="mt-2 w-full py-1 text-center text-[12.5px] font-semibold text-cap active:text-danger"
      >
        마감 풀기
      </button>
    </div>
  )
}
