import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import AmountInput from './AmountInput'
import { abbreviateKRW, currentYm, formatComma, formatYmKorean } from '../lib/format'
import {
  LOAN_METHOD_LABEL,
  dayString,
  graduatedPlan,
  loanFromStart,
  loanTotalCost,
  paymentIfRateUp,
  monthlyPayment,
  payoffYm,
  type LoanInfo,
  type LoanMethod,
} from '../lib/loan'
import type { AssetItem } from '../types'
import { useLedgerStore } from '../lib/store'
import { resolveLedger } from '../lib/carryover'

const short = (n: number) => abbreviateKRW(n).replace(/원$/, '')

/**
 * 대출 정보 입력칸 (2026-10-07). 금리·갚는 날·남은 기간·방식을 받아, 다 채워지면 onChange로 알린다.
 * 부채를 처음 추가할 때(AssetEditor 추가 칸)와 이미 있는 부채(LoanEditor)가 같이 쓴다.
 */
export function LoanForm({
  amount,
  initial,
  onChange,
  onBalance,
  hideLedger = false,
}: {
  /** 남은 대출금 — 매달 갚는 돈 미리보기에 쓴다 */
  amount: number
  initial?: LoanInfo
  onChange: (draft: LoanInfo | null) => void
  /** '처음 빌린 돈으로' 적으면 계산한 지금 남은 돈을 알린다 — 부채 금액을 이 값으로 맞춘다 */
  onBalance?: (balance: number) => void
  /** 돈 공부 '대출 이자' 계산기처럼 저장하지 않는 곳에선 '가계부에도 넣기'를 숨긴다 */
  hideLedger?: boolean
}) {
  // 처음 빌린 돈으로(기본) / 남은 돈으로 (2026-11-24 — 남은 돈에 처음 기간을 넣으면 매달 갚는 돈이 적게 나왔다)
  const [mode, setMode] = useState<'start' | 'balance'>(
    initial ? (initial.start ? 'start' : 'balance') : hideLedger ? 'balance' : 'start',
  )
  const st = initial?.start
  const [principal, setPrincipal] = useState(st?.principal ?? 0)
  const [startYm, setStartYm] = useState(st?.startYm ?? '')
  const [prepaid, setPrepaid] = useState(st?.prepaid ?? 0)
  const firstMonths = st ? st.totalMonths : initial?.months
  const [rate, setRate] = useState(initial ? String(initial.rate) : '')
  const [years, setYears] = useState(firstMonths ? String(Math.floor(firstMonths / 12)) : '')
  const [months, setMonths] = useState(firstMonths ? String(firstMonths % 12) : '')
  const [payDay, setPayDay] = useState(initial?.payDay ?? 25)
  const [method, setMethod] = useState<LoanMethod>(initial?.method ?? 'annuity')
  // 고정지출에 이미 대출 항목이 있으면 처음엔 끈다 — 켜 두면 두 번 셌다 (2026-11-19 점검)
  const existingLoan = useLedgerStore((s) =>
    resolveLedger(s.ledgers, currentYm()).items.find(
      (it) => it.group === 'fixed' && /대출|상환|이자/.test(it.category),
    ),
  )
  const [toLedger, setToLedger] = useState(initial?.toLedger ?? !existingLoan)

  const totalMonths = (Number(years) || 0) * 12 + (Number(months) || 0)
  const fromStart =
    mode === 'start' &&
    rate !== '' &&
    totalMonths > 0 &&
    principal > 0 &&
    /^\d{4}-\d{2}$/.test(startYm)
      ? loanFromStart(
          { principal, totalMonths, startYm, prepaid },
          { rate: Number(rate), payDay, method },
          new Date(),
        )
      : null
  const draft: LoanInfo | null =
    mode === 'start'
      ? fromStart
        ? {
            ...fromStart.loan,
            toLedger,
            start: { principal, totalMonths, startYm, ...(prepaid > 0 ? { prepaid } : {}) },
          }
        : null
      : rate !== '' && totalMonths > 0
        ? {
            rate: Number(rate),
            months: totalMonths,
            payDay,
            method,
            asOf: initial?.asOf ?? dayString(new Date()),
            toLedger,
            // 체증식 — 지금 남은 원금으로 첫 달 갚는 돈과 매달 늘어나는 금액을 잡아 둔다
            ...(method === 'graduated' && amount > 0
              ? (() => {
                  const plan = graduatedPlan(amount, Number(rate), totalMonths)
                  return { gradPayment: plan.first, gradStep: plan.step }
                })()
              : {}),
          }
        : null
  const balance = mode === 'start' ? (fromStart?.balance ?? 0) : amount
  const key = JSON.stringify([draft, mode === 'start' ? balance : null])
  useEffect(() => {
    onChange(draft)
    if (mode === 'start' && fromStart) onBalance?.(fromStart.balance)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const preview = draft && balance > 0 ? monthlyPayment(balance, draft) : null
  const payoff = draft ? payoffYm(draft, new Date()) : null
  // 예시 글자(placeholder)가 채워진 값처럼 보여 "숫자가 고정이에요" 제보 (2026-10-07)
  // → 예시는 '예)'를 붙여 옅게, 단위는 칸 안 오른쪽에 따로
  const box =
    'mt-1 flex items-center gap-1 rounded-btn border border-line bg-white px-3 focus-within:border-brand'
  const input =
    'tnum min-w-0 w-full bg-transparent py-2 text-right text-[15px] font-semibold text-ink outline-none placeholder:text-[13px] placeholder:font-normal placeholder:text-cap/70'
  const unit = 'shrink-0 text-[13px] font-medium text-sub'
  const field =
    'mt-1 w-full rounded-btn border border-line bg-white px-3 py-2 text-right text-[14px] font-semibold text-ink outline-none focus:border-brand'

  const ymNow = currentYm()
  return (
    <div className="space-y-2">
      {!hideLedger && (
        <div
          className="flex gap-0.5 rounded-full bg-white p-0.5"
          role="tablist"
          aria-label="적는 방식"
        >
          {(['start', 'balance'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={mode === v}
              onClick={() => setMode(v)}
              className={`flex-1 rounded-full py-1.5 text-[12.5px] font-bold ${
                mode === v ? 'bg-brand text-white' : 'text-sub'
              }`}
            >
              {v === 'start' ? '처음 빌린 돈으로' : '남은 돈으로'}
            </button>
          ))}
        </div>
      )}
      {mode === 'start' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="col-span-2 text-[11.5px] text-cap">
            처음 빌린 돈 (대출 원금)
            <AmountInput
              value={principal}
              onChange={setPrincipal}
              placeholder="예) 300,000,000"
              className="mt-1"
            />
          </label>
          <label className="text-[11.5px] text-cap">
            대출 받은 달
            <input
              type="month"
              value={startYm}
              max={ymNow}
              onChange={(e) => setStartYm(e.target.value)}
              className={field}
            />
          </label>
          <label className="text-[11.5px] text-cap">
            미리 더 갚은 돈 (없으면 0)
            <AmountInput value={prepaid} onChange={setPrepaid} placeholder="0" className="mt-1" />
          </label>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11.5px] text-cap">
          연 금리
          <span className={box}>
            <input
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value.replace(/[^\d.]/g, ''))}
              placeholder="예) 4.2"
              className={input}
            />
            <span className={unit}>%</span>
          </span>
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
          {mode === 'start' ? '처음 정한 기간' : '남은 기간'}
          <span className={box}>
            <input
              inputMode="numeric"
              value={years}
              onChange={(e) => setYears(e.target.value.replace(/\D/g, ''))}
              placeholder="예) 30"
              className={input}
            />
            <span className={unit}>년</span>
          </span>
        </label>
        <label className="text-[11.5px] text-cap">
          몇 개월 더 <span className="text-cap/70">(2년 6개월이면 6)</span>
          <span className={box}>
            <input
              inputMode="numeric"
              value={months}
              onChange={(e) => setMonths(e.target.value.replace(/\D/g, '').slice(0, 2))}
              placeholder="0"
              className={input}
            />
            <span className={unit}>개월</span>
          </span>
        </label>
      </div>
      <div
        className="grid grid-cols-2 gap-1.5 min-[400px]:grid-cols-4"
        role="group"
        aria-label="갚는 방식"
      >
        {(Object.keys(LOAN_METHOD_LABEL) as LoanMethod[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            aria-pressed={method === m}
            className={`rounded-full border py-1.5 text-[12px] font-bold ${
              method === m ? 'border-brand bg-brand text-white' : 'border-line bg-white text-sub'
            }`}
          >
            {LOAN_METHOD_LABEL[m]}
          </button>
        ))}
      </div>
      {!hideLedger && (
        <label className="flex items-center gap-2 text-[12.5px] text-sub">
          <input
            type="checkbox"
            checked={toLedger}
            onChange={(e) => setToLedger(e.target.checked)}
            className="h-4 w-4 accent-[#3182F6]"
          />
          가계부 고정지출에도 '대출 상환'으로 매달 넣기
        </label>
      )}
      {!hideLedger && existingLoan && !initial && (
        <p className="-mt-1 text-[11.5px] leading-relaxed text-cap">
          고정지출에 '{existingLoan.category}'이 이미 있어서 꺼 뒀어요 · 켜면 두 번 셀 수 있어요
        </p>
      )}
      {fromStart && (
        <p className="rounded-btn bg-brand/10 px-3 py-2 text-[12.5px] leading-relaxed text-sub">
          {fromStart.balance > 0 ? (
            <>
              지금 남은 대출{' '}
              <b className="tnum text-[14px] font-bold text-ink">
                {formatComma(fromStart.balance)}원
              </b>
              <br />
              남은 기간 {Math.floor(fromStart.loan.months / 12)}년 {fromStart.loan.months % 12}개월
              {onBalance && ' · 부채 금액도 이 값으로 맞춰요'}
            </>
          ) : (
            '다 갚은 대출이에요'
          )}
        </p>
      )}
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
      {/* 다 갚을 때까지 총액·금리 오를 때 (2026-10-07, 부상구 대출 계산기 참고) */}
      {preview && draft?.method === 'graduated' && draft.gradStep !== undefined && (
        <p className="rounded-btn bg-white px-3 py-2 text-[12px] leading-relaxed text-sub">
          처음엔 적게 내고 매달 <b className="tnum text-ink">{formatComma(draft.gradStep)}원</b>씩
          늘어요 · 마지막 달 약{' '}
          <b className="tnum text-ink">
            {short((draft.gradPayment ?? 0) + draft.gradStep * (draft.months - 1))}원
          </b>
          <br />만 40세 미만이 디딤돌·보금자리론에서 고를 수 있어요. 공사 계산과 조금 다를 수 있는
          어림값이에요.
        </p>
      )}
      {preview && draft && <LoanRisk amount={balance} loan={draft} payment={preview.payment} />}
      {!draft && (
        <p className="px-1 text-[12px] text-cap">
          {mode === 'start'
            ? '처음 빌린 돈·받은 달·금리·기간을 넣으면 지금 남은 돈과 매달 갚는 돈이 계산돼요'
            : '금리와 남은 기간을 넣으면 매달 갚는 돈이 계산돼요'}
        </p>
      )}
      {draft && mode === 'balance' && amount <= 0 && (
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
  /** balance — '처음 빌린 돈으로' 계산한 지금 남은 돈 (부채 금액을 맞춘다) */
  onSave: (loan: LoanInfo | undefined, balance?: number) => void
}) {
  const saved = item.loan
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<LoanInfo | null>(saved ?? null)
  const [balance, setBalance] = useState<number | undefined>(undefined)

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
      <LoanForm
        amount={item.amount}
        initial={saved}
        onChange={(d) => {
          setDraft(d)
          if (!d?.start) setBalance(undefined)
        }}
        onBalance={setBalance}
      />
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
            onSave(draft, draft.start ? balance : undefined)
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

/** 다 갚을 때까지 총 얼마, 금리가 1%p 오르면 매달 얼마 */
function LoanRisk({ amount, loan, payment }: { amount: number; loan: LoanInfo; payment: number }) {
  const cost = loanTotalCost(amount, loan)
  const up = paymentIfRateUp(amount, loan)
  return (
    <div className="grid grid-cols-2 gap-2 text-[12px]">
      <div className="rounded-btn bg-white px-3 py-2">
        <p className="text-cap">다 갚을 때까지</p>
        <p className="tnum mt-0.5 font-bold text-ink">총 {short(cost.total)}원</p>
        <p className="tnum text-sub">이자만 {short(cost.interest)}원</p>
      </div>
      <div className="rounded-btn bg-white px-3 py-2">
        <p className="text-cap">금리가 1%p 오르면</p>
        <p className="tnum mt-0.5 font-bold text-ink">매달 {short(up)}원</p>
        <p className="tnum text-danger">+{short(up - payment)}원</p>
      </div>
    </div>
  )
}
