import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useLedgerStore } from '../lib/store'
import { deleteGiftReport, fetchChildRecords, fetchGiftReports, insertGiftReport } from '../lib/db'
import {
  GIFT_LIMIT_MINOR,
  GIFT_REPORT_KIND_LABEL,
  giftReportStatus,
  summarizeChild,
  type ChildRecord,
  type GiftReport,
  type GiftReportKind,
} from '../lib/childMoney'
import { abbreviateKRW, formatComma, formatWon } from '../lib/format'
import { GIFT_INCOME, SUPPORT_INCOME } from '../lib/constants'
import { genId } from '../lib/carryover'
import { BENEFIT_RULES } from '../lib/childBenefit'
import {
  RECURRING_DEFAULT_AMOUNT,
  RECURRING_KIND_LABEL,
  dueMonths,
  isRecurringRecord,
  lastDueYm,
  nextPay,
} from '../lib/childRecurring'
import type { ChildRecurring } from '../types'

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
  const [reports, setReports] = useState<GiftReport[]>([])

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

  // 증여 신고 기록 — 둘러보기(householdId 없음)에선 화면에만 남긴다
  useEffect(() => {
    let live = true
    if (!householdId || children.length === 0) return
    fetchGiftReports(householdId)
      .then((r) => live && setReports(r))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [householdId, children.length])

  const addReport = async (r: Omit<GiftReport, 'id'>) => {
    const saved = householdId
      ? await insertGiftReport(householdId, r)
      : { ...r, id: `local-${Date.now()}` }
    setReports((prev) => [saved, ...prev])
  }
  const removeReport = async (id: string) => {
    if (householdId && !id.startsWith('local-')) await deleteGiftReport(id)
    setReports((prev) => prev.filter((r) => r.id !== id))
  }

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
              <GiftReports
                name={name}
                gift10y={s.gift10y}
                reports={reports.filter((r) => r.child === name)}
                onAdd={addReport}
                onRemove={removeReport}
              />
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
            <RecurringList name={name} />
            <button
              onClick={() => navigate('/child-benefit')}
              className="mt-2 flex w-full items-center justify-center gap-0.5 text-[12px] font-bold text-sub"
            >
              부모급여·아동수당 앞으로 몇 달 더 받을까 <ChevronRight size={13} />
            </button>
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
                        {isRecurringRecord(c.id, c.createdAt, profile.childRecurring ?? []) && (
                          <span className="ml-1 rounded bg-brand/10 px-1 text-[10.5px] font-bold text-brand">
                            자동
                          </span>
                        )}
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

/** 아이 앞으로 들어온 돈 적기 — 아동수당·지원금 / 용돈·선물. 지원금은 '매달 들어와요'로 자동 기록을 걸 수 있다 */
function ChildIncomeForm({ name, onDone }: { name: string; onDone: () => void }) {
  const { addConfession, profile, updateProfile, runChildRecurring } = useLedgerStore()
  const today = new Date().toLocaleDateString('sv-SE')
  const thisYm = today.slice(0, 7)
  // 아이 카드에선 항목 목록과 상관없이 늘 두 가지 — 아이를 막 등록한 집도 바로 적게
  const kinds = [SUPPORT_INCOME, GIFT_INCOME]
  const [category, setCategory] = useState(SUPPORT_INCOME)
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [keep, setKeep] = useState(true)
  // 용돈·선물은 보통 부모·조부모가 준 돈 — 기본으로 증여에 센다.
  // 아동수당도 아이 통장으로 받았으면 체크해서 넣을 수 있다 (2026-10-27 결영이네 의견)
  const [gift, setGift] = useState(false)
  const [giftTouched, setGiftTouched] = useState(false)
  const effectiveGift = giftTouched ? gift : category === GIFT_INCOME

  // ── 매달 들어와요 (2026-10-27)
  const [repeat, setRepeat] = useState(false)
  const [rKind, setRKind] = useState<ChildRecurring['kind']>('allowance')
  const [day, setDay] = useState(25)
  const [startYm, setStartYm] = useState(thisYm)
  const [skip, setSkip] = useState<string[]>([])
  const knownBirth = profile.childBirths?.[name]
  const [birth, setBirth] = useState(knownBirth ?? '')
  const isRepeat = repeat && category === SUPPORT_INCOME
  const useBirth = rKind !== 'other'

  const pickKind = (k: ChildRecurring['kind']) => {
    // 금액을 손대지 않았으면 종류에 맞는 기본 금액으로
    if (amount === 0 || amount === RECURRING_DEFAULT_AMOUNT[rKind])
      setAmount(RECURRING_DEFAULT_AMOUNT[k])
    setRKind(k)
  }
  const draft: ChildRecurring = {
    id: 'draft',
    child: name,
    kind: rKind,
    label: rKind === 'other' ? note.trim() || '지원금' : RECURRING_KIND_LABEL[rKind],
    amount,
    // 0세 금액이 100만이면 돌 지나 50만, 어린이집이라 보육료를 뺀 금액이면 돌 지나 현금이 없다
    amountAfter1:
      rKind === 'parentPay'
        ? amount >= BENEFIT_RULES.parentPay0
          ? BENEFIT_RULES.parentPay1
          : BENEFIT_RULES.parentPayDaycare1
        : undefined,
    day,
    startYm,
    skip,
    childKeep: keep,
    gift: keep && effectiveGift,
  }
  const due = isRepeat && amount > 0 ? dueMonths(draft, (useBirth && birth) || undefined) : []
  const dueOn = due.filter((d) => !d.skipped)

  const save = () => {
    if (amount <= 0) return
    if (isRepeat) {
      const patch: Partial<typeof profile> = {
        childRecurring: [...(profile.childRecurring ?? []), { ...draft, id: genId() }],
      }
      if (useBirth && birth && birth !== knownBirth) {
        patch.childBirths = { ...(profile.childBirths ?? {}), [name]: birth }
      }
      updateProfile(patch)
      runChildRecurring()
      onDone()
      return
    }
    addConfession({
      category,
      kind: 'income',
      amount,
      note: note.trim() || undefined,
      createdAt: date === today ? undefined : new Date(`${date}T12:00:00`).toISOString(),
      child: name,
      childKeep: keep,
      gift: keep && effectiveGift ? true : undefined,
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
      {category === SUPPORT_INCOME && (
        <label className="flex items-center justify-between rounded-btn bg-white px-3 py-2.5">
          <span className="text-[13px] font-bold text-ink">
            매달 들어와요
            <span className="block text-[11px] font-normal text-cap">
              한 번 정하면 다음 달부터 알아서 적어요
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="매달 들어와요"
            checked={repeat}
            onChange={(e) => {
              setRepeat(e.target.checked)
              if (e.target.checked && amount === 0) setAmount(RECURRING_DEFAULT_AMOUNT[rKind])
            }}
            className="h-5 w-5 accent-amber-500"
          />
        </label>
      )}
      {isRepeat && (
        <div className="flex gap-1.5">
          {(['allowance', 'parentPay', 'other'] as const).map((k) => (
            <button
              key={k}
              onClick={() => pickKind(k)}
              aria-pressed={rKind === k}
              className={`min-w-0 flex-1 truncate rounded-btn py-2 text-[12.5px] font-bold ${
                rKind === k ? 'bg-ink text-white' : 'bg-white text-sub'
              }`}
            >
              {RECURRING_KIND_LABEL[k]}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          autoFocus
          inputMode="numeric"
          aria-label="들어온 금액"
          placeholder={isRepeat ? '매달 금액' : '금액'}
          value={amount ? formatComma(amount) : ''}
          onChange={(e) =>
            setAmount(Math.min(Number(e.target.value.replace(/[^\d]/g, '')) || 0, 999_999_999))
          }
          className="tnum min-w-0 flex-1 rounded-btn border border-line bg-white px-3 py-2 text-right text-[15px] font-bold text-ink outline-none focus:border-amber-500"
        />
        <span className="text-[13px] text-sub">원</span>
        {!isRepeat && (
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value || today)}
            aria-label="받은 날"
            className="tnum w-[132px] shrink-0 rounded-btn border border-line bg-white px-2 py-2 text-[12.5px] text-ink outline-none"
          />
        )}
      </div>
      {isRepeat ? (
        <>
          <div className="flex items-center gap-2 text-[12.5px] text-sub">
            <span className="shrink-0">매달</span>
            <select
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              aria-label="들어오는 날"
              className="tnum rounded-btn border border-line bg-white px-2 py-1.5 text-ink outline-none"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}일
                </option>
              ))}
            </select>
            <span className="ml-auto shrink-0">언제부터</span>
            <input
              type="month"
              value={startYm}
              max={thisYm}
              onChange={(e) => {
                setStartYm(e.target.value || thisYm)
                setSkip([])
              }}
              aria-label="언제부터"
              className="tnum w-[128px] rounded-btn border border-line bg-white px-2 py-1.5 text-ink outline-none"
            />
          </div>
          {useBirth && (
            <label className="flex items-center gap-2 text-[12.5px] text-sub">
              <span className="shrink-0">{name} 생일</span>
              <input
                type="date"
                value={birth}
                max={today}
                onChange={(e) => setBirth(e.target.value)}
                aria-label="아이 생일"
                className="tnum min-w-0 flex-1 rounded-btn border border-line bg-white px-2 py-1.5 text-ink outline-none"
              />
            </label>
          )}
          <p className="text-[11px] leading-relaxed text-cap">
            {rKind === 'parentPay'
              ? birth
                ? `돌 지나면 ${amount >= BENEFIT_RULES.parentPay0 ? '50만원으로' : '현금 없이(어린이집)'} 바뀌고 두 돌에 끝나요. 어린이집에 다니면 보육료 빼고 남는 돈으로 적어요.`
                : '생일을 넣으면 돌 지나 50만원으로 바뀌는 달, 끝나는 달을 알아서 맞춰요.'
              : rKind === 'allowance'
                ? birth
                  ? '받는 나이(2030년부터 13세 미만)가 끝나면 멈춰요. 사는 곳마다 10만~13만원이에요.'
                  : '생일을 넣으면 받는 나이가 끝날 때 알아서 멈춰요.'
                : '멈추기 전까지 매달 같은 금액으로 적어요.'}
          </p>
          {due.length > 0 && (
            <div className="rounded-btn bg-white px-3 py-2.5">
              <p className="text-[12.5px] font-bold text-ink">
                지난 달 {dueOn.length}건도 같이 넣어요
                <span className="ml-1 font-normal text-cap">받지 않은 달은 눌러서 빼요</span>
              </p>
              <div className="mt-2 grid grid-cols-4 gap-1">
                {due.map((d) => (
                  <button
                    key={d.ym}
                    onClick={() =>
                      setSkip((prev) =>
                        prev.includes(d.ym) ? prev.filter((x) => x !== d.ym) : [...prev, d.ym],
                      )
                    }
                    aria-pressed={!d.skipped}
                    aria-label={`${d.ym} ${d.skipped ? '뺐어요' : '넣어요'}`}
                    className={`rounded-lg py-1.5 text-center text-[11px] leading-tight ${
                      d.skipped ? 'bg-bg text-cap line-through' : 'bg-amber-50 text-ink'
                    }`}
                  >
                    <span className="tnum block font-bold">
                      {d.ym.slice(2, 4)}.{Number(d.ym.slice(5))}
                    </span>
                    <span className="tnum">{abbreviateKRW(d.amount).replace('원', '')}</span>
                  </button>
                ))}
              </div>
              <p className="tnum mt-2 text-right text-[12.5px] font-bold text-ink">
                {dueOn.length}건 합계 {abbreviateKRW(dueOn.reduce((s, d) => s + d.amount, 0))}
              </p>
            </div>
          )}
        </>
      ) : (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            category === GIFT_INCOME
              ? '누가 줬어요? (예: 할머니 세뱃돈)'
              : '메모 (예: 10월 아동수당)'
          }
          aria-label="메모"
          maxLength={40}
          className="w-full rounded-btn border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none placeholder:text-cap"
        />
      )}
      {isRepeat && rKind === 'other' && (
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="이름 (예: 지자체 양육수당)"
          aria-label="지원금 이름"
          maxLength={20}
          className="w-full rounded-btn border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none placeholder:text-cap"
        />
      )}
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
      {/* 살림에 보탠 돈은 아이 통장에 안 남으니 증여 체크칸을 아예 안 보인다 (결영이네 의견) */}
      {keep && (
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
      )}
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
          {!isRepeat
            ? '적기'
            : dueOn.length > 0
              ? `${dueOn.length}건 넣고 매달 적기`
              : '매달 적기 시작'}
        </button>
      </div>
    </div>
  )
}

/** 매달 들어오는 돈 — 다음에 언제 적히는지, 금액 고치기·멈추기 */
function RecurringList({ name }: { name: string }) {
  const { profile, updateProfile } = useLedgerStore()
  const rules = (profile.childRecurring ?? []).filter((r) => r.child === name)
  const birth = profile.childBirths?.[name]
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState(0)
  if (rules.length === 0) return null

  const patch = (id: string, p: Partial<ChildRecurring>) =>
    updateProfile({
      childRecurring: (profile.childRecurring ?? []).map((r) => (r.id === id ? { ...r, ...p } : r)),
    })
  const remove = (id: string) =>
    updateProfile({ childRecurring: (profile.childRecurring ?? []).filter((r) => r.id !== id) })

  return (
    <div className="mt-3 rounded-btn bg-bg px-3 py-2.5">
      <p className="text-[12px] font-bold text-sub">매달 들어오는 돈</p>
      <ul className="mt-1 divide-y divide-line/70">
        {rules.map((r) => {
          const next = nextPay(r, birth)
          const ended = !next
          return (
            <li key={r.id} className="py-2">
              <div className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="min-w-0 truncate font-bold text-ink">
                  {r.label}
                  <span className="ml-1 font-normal text-cap">매달 {r.day}일</span>
                </span>
                <span className="tnum shrink-0 font-bold text-ink">
                  월 {abbreviateKRW(next?.amount ?? r.amount)}
                </span>
              </div>
              <p className="mt-0.5 text-[11.5px] text-cap">
                {r.stoppedYm
                  ? '멈췄어요'
                  : ended
                    ? '받는 기간이 끝났어요'
                    : `다음은 ${next.date.getMonth() + 1}월 ${next.date.getDate()}일에 자동으로 적어요`}
              </p>
              {editing === r.id ? (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    inputMode="numeric"
                    aria-label="매달 금액 고치기"
                    value={draft ? formatComma(draft) : ''}
                    onChange={(e) =>
                      setDraft(
                        Math.min(Number(e.target.value.replace(/[^\d]/g, '')) || 0, 99_999_999),
                      )
                    }
                    className="tnum min-w-0 flex-1 rounded-btn border border-line bg-white px-2 py-1.5 text-right text-[13px] font-bold text-ink outline-none"
                  />
                  <button
                    onClick={() => {
                      if (draft > 0) patch(r.id, { amount: draft })
                      setEditing(null)
                    }}
                    className="rounded-btn bg-ink px-3 py-1.5 text-[12px] font-bold text-white"
                  >
                    저장
                  </button>
                </div>
              ) : (
                <div className="mt-1.5 flex gap-1.5">
                  {!ended && (
                    <button
                      onClick={() => {
                        setDraft(r.amount)
                        setEditing(r.id)
                      }}
                      className="flex-1 rounded-btn bg-white py-1.5 text-[12px] font-bold text-sub"
                    >
                      금액 고치기
                    </button>
                  )}
                  {r.stoppedYm ? (
                    <button
                      // 다시 시작해도 멈췄던 사이 달은 채우지 않는다 — 이번 달까지 적은 걸로 본다
                      onClick={() =>
                        patch(r.id, { stoppedYm: undefined, doneYm: lastDueYm(r.day) })
                      }
                      className="flex-1 rounded-btn bg-white py-1.5 text-[12px] font-bold text-sub"
                    >
                      다시 시작
                    </button>
                  ) : (
                    !ended && (
                      <button
                        onClick={() => patch(r.id, { stoppedYm: lastDueYm(r.day) })}
                        className="flex-1 rounded-btn bg-white py-1.5 text-[12px] font-bold text-sub"
                      >
                        멈추기
                      </button>
                    )
                  )}
                  {(r.stoppedYm || ended) && (
                    <button
                      onClick={() => remove(r.id)}
                      className="flex-1 rounded-btn bg-white py-1.5 text-[12px] font-bold text-sub"
                    >
                      목록에서 빼기
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * 증여 신고 했는지 (2026-10-27) — 증여로 적은 돈 중 신고한 돈 / 아직 안 한 돈.
 * 정기금(매달 주기로 하고 한 번에 신고)은 계약한 전체 금액을 적어서, 앞으로 넣을 돈까지 신고된 걸로 본다.
 */
function GiftReports({
  name,
  gift10y,
  reports,
  onAdd,
  onRemove,
}: {
  name: string
  gift10y: number
  reports: GiftReport[]
  onAdd: (r: Omit<GiftReport, 'id'>) => Promise<void>
  onRemove: (id: string) => Promise<void>
}) {
  const navigate = useNavigate()
  const { reported, unreported } = giftReportStatus(reports, name, gift10y)
  const [open, setOpen] = useState(false)
  if (gift10y === 0 && reports.length === 0) {
    return (
      <button
        onClick={() => navigate('/gift-guide')}
        className="mt-2 flex items-center gap-0.5 text-[12px] font-bold text-amber-700"
      >
        아이 통장 증여 신고, 해야 할까? <ChevronRight size={13} />
      </button>
    )
  }
  return (
    <div className="mt-2.5 border-t border-line/70 pt-2.5">
      <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
        <span className="font-bold text-sub">증여 신고</span>
        {unreported > 0 ? (
          <span className="tnum font-bold text-amber-700">
            아직 안 한 돈 {abbreviateKRW(unreported)}
          </span>
        ) : (
          <span className="font-bold text-brand">기록한 증여는 다 신고했어요</span>
        )}
      </div>
      {reports.length > 0 && (
        <ul className="mt-1.5 space-y-1">
          {reports.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-[12px]">
              <span className="tnum shrink-0 text-cap">{r.reportedOn.replace(/-/g, '.')}</span>
              <span className="min-w-0 flex-1 truncate text-sub">
                {GIFT_REPORT_KIND_LABEL[r.kind]} 신고
                {r.note && <span className="text-cap"> · {r.note}</span>}
              </span>
              <span className="tnum shrink-0 font-bold text-ink">{abbreviateKRW(r.amount)}</span>
              <button
                onClick={() => void onRemove(r.id).catch(() => undefined)}
                aria-label="신고 기록 지우기"
                className="shrink-0 text-cap active:text-danger"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {reported > 0 && unreported > 0 && (
        <p className="tnum mt-1 text-[11px] text-cap">신고한 돈 {abbreviateKRW(reported)}</p>
      )}
      {open ? (
        <GiftReportForm
          suggested={unreported}
          onCancel={() => setOpen(false)}
          onSave={async (r) => {
            await onAdd({ ...r, child: name })
            setOpen(false)
          }}
        />
      ) : (
        <div className="mt-2 flex gap-1.5">
          <button
            onClick={() => setOpen(true)}
            className="flex-1 rounded-btn bg-white py-2 text-[12.5px] font-bold text-ink active:bg-line"
          >
            증여 신고했어요
          </button>
          <button
            onClick={() => navigate('/gift-guide')}
            className="flex flex-1 items-center justify-center gap-0.5 rounded-btn bg-white py-2 text-[12.5px] font-bold text-amber-700 active:bg-line"
          >
            신고하는 법 <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

function GiftReportForm({
  suggested,
  onCancel,
  onSave,
}: {
  suggested: number
  onCancel: () => void
  onSave: (r: Omit<GiftReport, 'id' | 'child'>) => Promise<void>
}) {
  const today = new Date().toLocaleDateString('sv-SE')
  const [kind, setKind] = useState<GiftReportKind>('lump')
  const [amount, setAmount] = useState(suggested)
  const [reportedOn, setReportedOn] = useState(today)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const save = async () => {
    if (amount <= 0 || busy) return
    setBusy(true)
    setFailed(false)
    try {
      await onSave({ kind, amount, reportedOn })
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-btn bg-white px-3 py-3">
      <div className="flex gap-1.5">
        {(['lump', 'periodic'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`min-w-0 flex-1 truncate rounded-btn py-2 text-[12.5px] font-bold ${
              kind === k ? 'bg-ink text-white' : 'bg-bg text-sub'
            }`}
          >
            {k === 'lump' ? '한 번에 신고' : '정기금으로 신고'}
          </button>
        ))}
      </div>
      <p className="text-[11px] leading-relaxed text-cap">
        {kind === 'lump'
          ? '이미 넣은 돈을 신고했어요. 여러 번 준 걸 한꺼번에 신고했으면 합친 금액을 적어요.'
          : '매달 정해진 돈을 주기로 하고 한 번에 신고했어요. 앞으로 넣을 돈까지 합친 전체 금액을 적어요.'}
      </p>
      <div className="flex items-center gap-2">
        <input
          inputMode="numeric"
          aria-label="신고한 금액"
          placeholder="신고한 금액"
          value={amount ? formatComma(amount) : ''}
          onChange={(e) =>
            setAmount(Math.min(Number(e.target.value.replace(/[^\d]/g, '')) || 0, 9_999_999_999))
          }
          className="tnum min-w-0 flex-1 rounded-btn border border-line bg-white px-3 py-2 text-right text-[14px] font-bold text-ink outline-none focus:border-amber-500"
        />
        <span className="text-[13px] text-sub">원</span>
        <input
          type="date"
          value={reportedOn}
          max={today}
          onChange={(e) => setReportedOn(e.target.value || today)}
          aria-label="신고한 날"
          className="tnum w-[132px] shrink-0 rounded-btn border border-line bg-white px-2 py-2 text-[12.5px] text-ink outline-none"
        />
      </div>
      {failed && (
        <p className="text-[12px] text-danger">저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="h-9 flex-1 rounded-btn bg-bg text-[13px] font-bold text-sub"
        >
          닫기
        </button>
        <button
          onClick={() => void save()}
          disabled={amount <= 0 || busy}
          className="h-9 flex-[2] rounded-btn bg-ink text-[13px] font-bold text-white disabled:opacity-40"
        >
          신고 기록 남기기
        </button>
      </div>
    </div>
  )
}
