import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { abbreviateKRW, formatYmKorean } from '../lib/format'
import {
  LOAN_METHOD_LABEL,
  dayString,
  monthlyPayment,
  payoffYm,
  type LoanInfo,
  type LoanMethod,
} from '../lib/loan'
import type { AssetItem } from '../types'

const short = (n: number) => abbreviateKRW(n).replace(/원$/, '')

/**
 * 대출 정보 입력칸 (2026-10-07). 금리·갚는 날·남은 기간·방식을 받아, 다 채워지면 onChange로 알린다.
 * 부채를 처음 추가할 때(AssetEditor 추가 칸)와 이미 있는 부채(LoanEditor)가 같이 쓴다.
 */
export function LoanForm({
  amount,
  initial,
  onChange,
}: {
  /** 남은 대출금 — 매달 갚는 돈 미리보기에 쓴다 */
  amount: number
  initial?: LoanInfo
  onChange: (draft: LoanInfo | null) => void
}) {
  const [rate, setRate] = useState(initial ? String(initial.rate) : '')
  const [years, setYears] = useState(initial ? String(Math.floor(initial.months / 12)) : '')
  const [months, setMonths] = useState(initial ? String(initial.months % 12) : '0')
  const [payDay, setPayDay] = useState(initial?.payDay ?? 25)
  const [method, setMethod] = useState<LoanMethod>(initial?.method ?? 'annuity')
  const [toLedger, setToLedger] = useState(initial?.toLedger ?? true)

  const totalMonths = (Number(years) || 0) * 12 + (Number(months) || 0)
  const draft: LoanInfo | null =
    rate !== '' && totalMonths > 0
      ? {
          rate: Number(rate),
          months: totalMonths,
          payDay,
          method,
          asOf: initial?.asOf ?? dayString(new Date()),
          toLedger,
        }
      : null
  const key = JSON.stringify(draft)
  useEffect(() => {
    onChange(draft)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const preview = draft && amount > 0 ? monthlyPayment(amount, draft) : null
  const payoff = draft ? payoffYm(draft, new Date()) : null
  const field =
    'mt-1 w-full rounded-btn border border-line bg-white px-3 py-2 text-right text-[14px] font-semibold text-ink outline-none focus:border-brand'

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11.5px] text-cap">
          연 금리(%)
          <input
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="4.2"
            className={field}
          />
        </label>
        <label className="text-[11.5px] text-cap">
          매달 갚는 날
          <select
            value={payDay}
            onChange={(e) => setPayDay(Number(e.target.value))}
            className={field}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d === 31 ? '말일' : `${d}일`}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11.5px] text-cap">
          남은 기간(년)
          <input
            inputMode="numeric"
            value={years}
            onChange={(e) => setYears(e.target.value.replace(/\D/g, ''))}
            placeholder="28"
            className={field}
          />
        </label>
        <label className="text-[11.5px] text-cap">
          + 개월
          <input
            inputMode="numeric"
            value={months}
            onChange={(e) => setMonths(e.target.value.replace(/\D/g, '').slice(0, 2))}
            className={field}
          />
        </label>
      </div>
      <div className="flex gap-1.5" role="group" aria-label="갚는 방식">
        {(Object.keys(LOAN_METHOD_LABEL) as LoanMethod[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            aria-pressed={method === m}
            className={`flex-1 rounded-full border py-1.5 text-[12px] font-bold ${
              method === m ? 'border-brand bg-brand text-white' : 'border-line bg-white text-sub'
            }`}
          >
            {LOAN_METHOD_LABEL[m]}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-[12.5px] text-sub">
        <input
          type="checkbox"
          checked={toLedger}
          onChange={(e) => setToLedger(e.target.checked)}
          className="h-4 w-4 accent-[#3182F6]"
        />
        가계부 고정지출에도 '대출 상환'으로 매달 넣기
      </label>
      {preview && (
        <p className="rounded-btn bg-white px-3 py-2 text-[12.5px] leading-relaxed text-sub">
          매달 <b className="tnum text-[14px] font-bold text-brand">{short(preview.payment)}원</b> ·
          이자 {short(preview.interest)} · 원금 {short(preview.principal)}
          {payoff && (
            <>
              <br />
              갚는 날마다 남은 대출이 원금만큼 줄어요 · 다 갚는 달 {formatYmKorean(payoff)}
            </>
          )}
        </p>
      )}
      {draft && amount <= 0 && (
        <p className="px-1 text-[12px] text-cap">남은 대출금을 넣으면 매달 갚는 돈이 보여요</p>
      )}
    </div>
  )
}

/**
 * 이미 있는 부채 항목의 '대출 정보' (2026-10-07). 넣으면 매달 갚는 돈이 보이고, 갚는 날마다 남은 대출이 줄어든다.
 * 안 넣으면 예전처럼 남은 금액만 적는다.
 */
export default function LoanEditor({
  item,
  onSave,
}: {
  item: AssetItem
  onSave: (loan: LoanInfo | undefined) => void
}) {
  const saved = item.loan
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<LoanInfo | null>(saved ?? null)

  if (!open) {
    const p = saved ? monthlyPayment(item.amount, saved) : null
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center justify-between rounded-btn bg-bg px-3 py-2 text-left text-[12.5px]"
      >
        {p ? (
          <span className="text-sub">
            매달 <b className="tnum font-bold text-ink">{short(p.payment)}원</b> 갚아요 · 이자{' '}
            {short(p.interest)} · 원금 {short(p.principal)}
          </span>
        ) : (
          <span className="font-semibold text-brand">대출 정보 넣기 · 매달 갚는 돈 계산</span>
        )}
        <ChevronRight size={15} className="shrink-0 text-cap" />
      </button>
    )
  }

  return (
    <div className="mt-2 space-y-2 rounded-btn bg-bg p-3">
      <button
        onClick={() => setOpen(false)}
        className="flex w-full items-center justify-between text-[12.5px] font-bold text-sub"
      >
        대출 정보
        <ChevronDown size={15} className="text-cap" />
      </button>
      <LoanForm amount={item.amount} initial={saved} onChange={setDraft} />
      <div className="flex gap-2">
        {saved && (
          <button
            onClick={() => {
              onSave(undefined)
              setOpen(false)
            }}
            className="h-10 rounded-btn bg-white px-3 text-[13px] font-semibold text-sub"
          >
            지우기
          </button>
        )}
        <button
          onClick={() => {
            if (!draft) return
            onSave(draft)
            setOpen(false)
          }}
          disabled={!draft}
          className="h-10 flex-1 rounded-btn bg-brand text-[14px] font-bold text-white disabled:opacity-40"
        >
          저장
        </button>
      </div>
    </div>
  )
}
