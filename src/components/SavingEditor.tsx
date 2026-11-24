import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import AmountInput from './AmountInput'
import { abbreviateKRW } from '../lib/format'
import { dayString } from '../lib/loan'
import { nextSavingDate, savingAtEnd, type SavingPlan } from '../lib/saving'
import type { AssetItem } from '../types'

const short = (n: number) => abbreviateKRW(n).replace(/원$/, '')
const md = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`
const ymLabel = (ym: string) => `${ym.slice(0, 4)}년 ${Number(ym.slice(5))}월`

/**
 * 적금 자동 저축 입력칸 (2026-11-24). 매달 넣는 돈·넣는 날·만기(선택).
 * 예적금을 처음 추가할 때(AssetEditor 추가 칸)와 이미 있는 항목(SavingEditor)이 같이 쓴다.
 */
export function SavingForm({
  amount,
  initial,
  onChange,
}: {
  /** 지금 잔액 — 만기 때 얼마 되는지 미리보기에 쓴다 */
  amount: number
  initial?: SavingPlan
  onChange: (plan: SavingPlan | null) => void
}) {
  const [monthly, setMonthly] = useState(initial?.monthly ?? 0)
  const [day, setDay] = useState(initial?.day ?? 25)
  const [endYm, setEndYm] = useState(initial?.endYm ?? '')
  const today = new Date()

  const emit = (p: { monthly: number; day: number; endYm: string }) =>
    onChange(
      p.monthly > 0
        ? {
            monthly: p.monthly,
            day: p.day,
            // 오늘까지 넣은 돈은 지금 잔액에 들어 있다고 본다 — 다음 넣는 날부터 더한다
            asOf: initial?.asOf ?? dayString(today),
            ...(p.endYm ? { endYm: p.endYm } : {}),
          }
        : null,
    )
  const plan: SavingPlan | null =
    monthly > 0 ? { monthly, day, asOf: dayString(today), endYm: endYm || undefined } : null
  const next = plan ? nextSavingDate(plan, today) : null
  const atEnd = plan ? savingAtEnd(amount, plan, today) : null

  return (
    <div className="space-y-2">
      <div>
        <span className="mb-1 block text-[12px] font-bold text-sub">매달 넣는 돈</span>
        <AmountInput
          value={monthly}
          onChange={(v) => {
            setMonthly(v)
            emit({ monthly: v, day, endYm })
          }}
          placeholder="예) 300,000"
          ariaLabel="매달 넣는 돈"
        />
      </div>
      <div className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-[12px] font-bold text-sub">넣는 날</span>
          <select
            value={day}
            onChange={(e) => {
              const v = Number(e.target.value)
              setDay(v)
              emit({ monthly, day: v, endYm })
            }}
            aria-label="넣는 날"
            className="w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                매달 {d}일
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-[12px] font-bold text-sub">만기 (선택)</span>
          <input
            type="month"
            value={endYm}
            onChange={(e) => {
              setEndYm(e.target.value)
              emit({ monthly, day, endYm: e.target.value })
            }}
            aria-label="만기 달"
            className="w-full rounded-btn border border-line bg-white px-3 py-2 text-[14px] text-ink outline-none focus:border-brand"
          />
        </label>
      </div>
      {plan && (
        <p className="rounded-btn bg-white px-3 py-2 text-[12.5px] leading-relaxed text-sub">
          {next ? (
            <>
              <b className="text-ink">{md(next)}</b>부터 넣는 날마다{' '}
              <b className="tnum text-brand">+{short(monthly)}원</b>씩 잔액에 더해요
            </>
          ) : (
            '만기가 지나서 더 이상 더하지 않아요'
          )}
          {atEnd !== null && next && (
            <>
              <br />
              {ymLabel(endYm)} 만기 때 약 <b className="tnum text-ink">{short(atEnd)}원</b> (이자
              빼고)
            </>
          )}
        </p>
      )}
      <p className="px-1 text-[11.5px] leading-relaxed text-cap">
        지금 잔액엔 오늘까지 넣은 돈이 들어 있다고 보고, 다음 넣는 날부터 더해요
      </p>
    </div>
  )
}

/** 예적금 줄 아래 — 접혀 있으면 한 줄 요약, 누르면 고치기 */
export default function SavingEditor({
  item,
  onSave,
}: {
  item: AssetItem
  onSave: (plan: SavingPlan | undefined) => void
}) {
  const saved = item.saving
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<SavingPlan | null>(saved ?? null)

  if (!open) {
    const next = saved ? nextSavingDate(saved, new Date()) : null
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center justify-between rounded-btn bg-bg px-3 py-2 text-left text-[12.5px]"
      >
        {saved ? (
          <span className="text-sub">
            매달 {saved.day}일{' '}
            <b className="tnum font-bold text-brand">+{short(saved.monthly)}원</b> 자동 저축
            {next ? ` · 다음 ${md(next)}` : ' · 만기 끝'}
          </span>
        ) : (
          <span className="font-semibold text-brand">매달 자동으로 쌓기 (적금)</span>
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
        적금 자동 저축
        <ChevronDown size={15} className="text-cap" />
      </button>
      <SavingForm amount={item.amount} initial={saved} onChange={setDraft} />
      <div className="flex gap-2">
        {saved && (
          <button
            onClick={() => {
              onSave(undefined)
              setOpen(false)
            }}
            className="h-10 rounded-btn bg-white px-3 text-[13px] font-semibold text-sub"
          >
            끄기
          </button>
        )}
        <button
          onClick={() => {
            if (!draft) return
            onSave(draft)
            setOpen(false)
          }}
          disabled={!draft}
          className="h-10 flex-1 rounded-btn bg-brand text-[13px] font-bold text-white disabled:opacity-40"
        >
          저장
        </button>
      </div>
    </div>
  )
}
