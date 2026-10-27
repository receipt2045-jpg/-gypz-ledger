import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useLedgerStore } from '../lib/store'
import { fetchChildRecords } from '../lib/db'
import { GIFT_LIMIT_MINOR, summarizeChild, type ChildRecord } from '../lib/childMoney'
import { abbreviateKRW, formatComma, formatWon } from '../lib/format'
import { GIFT_INCOME, SUPPORT_INCOME } from '../lib/constants'

/**
 * 자산 탭 — 아이 통장 (2026-10-27).
 * 아이 이름으로 들어온 돈(올해)과 '부모·조부모가 준 돈'의 10년 누적을 증여 한도와 같이 본다.
 * 아이 이름 자산(통장)은 자산 등록에서 소유자를 아이로 고른 것.
 * 들어온 돈은 이 카드에서 바로 적는다 — 소비 기록 화면은 쓴 돈 자리라 수입과 안 어울린다(결영이네 의견).
 */
export default function ChildMoneyCard({ childAssets }: { childAssets: Record<string, number> }) {
  const navigate = useNavigate()
  const { householdId, confessions, profile, removeConfession } = useLedgerStore()
  const children = profile.childNames ?? []
  const [records, setRecords] = useState<ChildRecord[] | null>(null)
  const [writing, setWriting] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    if (!householdId || children.length === 0) return
    fetchChildRecords(householdId)
      .then((r) => live && setRecords(r))
      .catch(() => live && setRecords(null))
    return () => {
      live = false
    }
    // 아이 이름이 바뀌거나 새 기록이 생기면 다시 읽는다
  }, [householdId, children.length, confessions.length])

  // 서버에서 못 읽으면(둘러보기 등) 앱에 있는 최근 기록으로
  const all: ChildRecord[] = useMemo(
    () =>
      records ??
      confessions
        .filter((c) => c.child)
        .map((c) => ({
          child: c.child!,
          category: c.category,
          amount: c.amount,
          childKeep: c.childKeep !== false,
          gift: !!c.gift,
          createdAt: c.createdAt,
        })),
    [records, confessions],
  )

  if (children.length === 0) return null

  return (
    <section aria-label="아이 통장" className="space-y-2.5">
      {children.map((name) => {
        const s = summarizeChild(all, name)
        const asset = childAssets[name] ?? 0
        const giftRatio = Math.min(1, s.gift10y / GIFT_LIMIT_MINOR)
        return (
          <div key={name} className="rounded-card bg-card px-4 py-3.5 shadow-card">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[15px] font-bold text-ink">🧒 {name} 통장</span>
              {/* 통장 금액 — 누르면 그 아이 이름으로 자산(통장) 넣기 */}
              <button
                onClick={() => navigate('/asset-setup', { state: { owner: name } })}
                className="flex items-center gap-0.5 text-[15px] font-bold text-ink active:opacity-60"
              >
                {asset > 0 ? (
                  <span className="tnum">{abbreviateKRW(asset)}</span>
                ) : (
                  <span className="text-[13px] text-brand">통장 넣기</span>
                )}
                <ChevronRight size={15} className="text-cap" />
              </button>
            </div>
            <p className="mt-1 text-[13px] text-sub">
              올해 {name} 앞으로 들어온 돈{' '}
              <b className="tnum font-bold text-ink">+{abbreviateKRW(s.yearTotal)}</b>
            </p>
            {s.yearTotal > 0 && (
              <p className="text-[11.5px] text-cap">
                아동수당·지원금 {abbreviateKRW(s.yearSupport)} · 용돈·선물{' '}
                {abbreviateKRW(s.yearGift)}
                {s.yearToHousehold > 0 && ` · 살림에 보탠 돈 ${abbreviateKRW(s.yearToHousehold)}`}
              </p>
            )}
            <div className="mt-3 rounded-btn bg-bg px-3 py-2.5">
              <div className="flex items-baseline justify-between text-[12.5px]">
                <span className="font-bold text-sub">부모·조부모가 준 돈 (증여)</span>
                <span className="tnum font-bold text-ink">
                  {abbreviateKRW(s.gift10y)} / {abbreviateKRW(GIFT_LIMIT_MINOR)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full rounded-full ${giftRatio >= 0.9 ? 'bg-danger' : 'bg-amber-500'}`}
                  style={{ width: `${giftRatio * 100}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-cap">
                미성년 자녀는 10년간 합쳐 2,000만원까지 증여세가 없어요. '부모·조부모가 준 돈'으로
                체크한 기록만 더했어요 · 참고용이에요
              </p>
            </div>
            {writing === name ? (
              <ChildIncomeForm name={name} onDone={() => setWriting(null)} />
            ) : (
              <button
                onClick={() => setWriting(name)}
                className="mt-3 flex w-full items-center justify-center gap-1 rounded-btn bg-amber-50 py-2.5 text-[13.5px] font-bold text-amber-700 active:bg-amber-100"
              >
                <Plus size={15} /> {name} 앞으로 들어온 돈 적기
              </button>
            )}
            {/* 최근 기록 (앱에 있는 최근 62일) — 잘못 적은 건 여기서 지운다 */}
            {confessions.some((c) => c.child === name) && (
              <div className="mt-2.5 divide-y divide-line/70">
                {confessions
                  .filter((c) => c.child === name)
                  .slice(0, 4)
                  .map((c) => (
                    <div key={c.id} className="flex items-center gap-2 py-2 text-[13px]">
                      <span className="tnum shrink-0 text-[11.5px] text-cap">
                        {new Date(c.createdAt).getMonth() + 1}/{new Date(c.createdAt).getDate()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {c.category}
                        {c.note && <span className="text-cap"> · {c.note}</span>}
                        {c.gift && (
                          <span className="ml-1 text-[11px] font-bold text-amber-600">증여</span>
                        )}
                        {c.childKeep === false && (
                          <span className="ml-1 text-[11px] font-bold text-sub">살림에</span>
                        )}
                      </span>
                      <span className="tnum shrink-0 font-bold text-brand">
                        +{formatWon(c.amount)}
                      </span>
                      <button
                        onClick={() => removeConfession(c.id)}
                        aria-label="기록 지우기"
                        className="shrink-0 text-cap active:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

/** 아이 앞으로 들어온 돈 적기 — 아동수당·지원금 / 용돈·선물 */
function ChildIncomeForm({ name, onDone }: { name: string; onDone: () => void }) {
  const { addConfession, categories } = useLedgerStore()
  const today = new Date().toLocaleDateString('sv-SE')
  const kinds = [SUPPORT_INCOME, GIFT_INCOME].filter((k) => categories.income.includes(k))
  const [category, setCategory] = useState(kinds[0] ?? SUPPORT_INCOME)
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [keep, setKeep] = useState(true)
  // 용돈·선물은 보통 부모·조부모가 준 돈 — 기본으로 증여에 센다.
  // 아동수당도 아이 통장으로 받았으면 체크해서 넣을 수 있다 (2026-10-27 결영이네 의견)
  const [gift, setGift] = useState(false)
  const [giftTouched, setGiftTouched] = useState(false)
  const effectiveGift = giftTouched ? gift : category === GIFT_INCOME

  const save = () => {
    if (amount <= 0) return
    addConfession({
      category,
      kind: 'income',
      amount,
      note: note.trim() || undefined,
      createdAt: date === today ? undefined : new Date(`${date}T12:00:00`).toISOString(),
      child: name,
      childKeep: keep,
      gift: effectiveGift ? true : undefined,
    })
    onDone()
  }

  return (
    <div className="mt-3 space-y-2.5 rounded-btn bg-amber-50/60 px-3 py-3">
      <div className="flex gap-1.5">
        {kinds.map((k) => (
          <button
            key={k}
            onClick={() => setCategory(k)}
            aria-pressed={category === k}
            className={`min-w-0 flex-1 truncate rounded-btn py-2 text-[12.5px] font-bold ${
              category === k ? 'bg-amber-500 text-white' : 'bg-white text-sub'
            }`}
          >
            {k}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          inputMode="numeric"
          aria-label="들어온 금액"
          placeholder="금액"
          value={amount ? formatComma(amount) : ''}
          onChange={(e) =>
            setAmount(Math.min(Number(e.target.value.replace(/[^\d]/g, '')) || 0, 999_999_999))
          }
          className="tnum min-w-0 flex-1 rounded-btn border border-line bg-white px-3 py-2 text-right text-[15px] font-bold text-ink outline-none focus:border-amber-500"
        />
        <span className="text-[13px] text-sub">원</span>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value || today)}
          aria-label="받은 날"
          className="tnum w-[132px] shrink-0 rounded-btn border border-line bg-white px-2 py-2 text-[12.5px] text-ink outline-none"
        />
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={
          category === GIFT_INCOME ? '누가 줬어요? (예: 할머니 세뱃돈)' : '메모 (예: 10월 아동수당)'
        }
        aria-label="메모"
        maxLength={40}
        className="w-full rounded-btn border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none placeholder:text-cap"
      />
      <div className="flex gap-1.5">
        {([true, false] as const).map((k) => (
          <button
            key={String(k)}
            onClick={() => setKeep(k)}
            aria-pressed={keep === k}
            className={`min-w-0 flex-1 truncate rounded-btn py-2 text-[12.5px] font-bold ${
              keep === k ? 'bg-ink text-white' : 'bg-white text-sub'
            }`}
          >
            {k ? `${name} 통장에 모아요` : '살림에 보태요'}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[12.5px] text-sub">
        <input
          type="checkbox"
          checked={effectiveGift}
          onChange={(e) => {
            setGiftTouched(true)
            setGift(e.target.checked)
          }}
          className="h-4 w-4 accent-amber-500"
        />
        증여 기록에 더해요 (부모·조부모가 준 돈, 아이 통장으로 받은 아동수당 등)
      </label>
      <div className="flex gap-2">
        <button
          onClick={onDone}
          className="h-10 flex-1 rounded-btn bg-white text-[13px] font-bold text-sub"
        >
          닫기
        </button>
        <button
          onClick={save}
          disabled={amount <= 0}
          className="h-10 flex-[2] rounded-btn bg-amber-500 text-[13.5px] font-bold text-white disabled:opacity-40"
        >
          적기
        </button>
      </div>
    </div>
  )
}
