import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { useLedgerStore } from '../lib/store'
import { resolveLedger } from '../lib/carryover'
import { currentYm } from '../lib/format'
import { readYearEndInput } from '../lib/yearEndTax'
import {
  START_STEPS,
  hideStartGuide,
  isStartGuideHidden,
  markStartSeen,
  readStartSeen,
  type StartStepKey,
} from '../lib/startGuide'

/**
 * 시작 가이드 — 홈 맨 위. 지금 할 일 하나를 크게, 나머지는 아래에 작게.
 * 예전엔 오늘 카드·바로가기 아래에 묻혀 있었고 자산·예산·기록 세 단계뿐이었다.
 * 다 끝내거나 닫으면 사라진다.
 */
export default function StartGuide() {
  const navigate = useNavigate()
  const { snapshots, ledgers, confessions, sample } = useLedgerStore()
  const [hidden, setHidden] = useState(isStartGuideHidden)
  // 예시 가계부에선 안 띄운다 — 할 일은 가입한 뒤 우리집 것으로
  if (hidden || sample) return null

  const ym = currentYm()
  const seen = readStartSeen()
  const yearEnd = readYearEndInput()
  const done: Record<StartStepKey, boolean> = {
    assets: snapshots.some((s) => s.items.length > 0),
    budget: resolveLedger(ledgers, ym).items.length > 0,
    confess: confessions.length > 0,
    yearEnd: seen.includes('yearEnd') || yearEnd.gross1 > 0 || yearEnd.gross2 > 0,
    calcs: seen.includes('calcs'),
  }
  const doneCount = START_STEPS.filter((s) => done[s.key]).length
  const current = START_STEPS.find((s) => !done[s.key])
  if (!current) return null

  const go = (key: StartStepKey) => {
    if (key === 'yearEnd' || key === 'calcs') markStartSeen(key)
    if (key === 'assets') navigate('/asset-setup')
    else if (key === 'budget') navigate('/budget', { state: { ym } })
    else if (key === 'confess') navigate('/confess')
    else if (key === 'yearEnd') navigate('/year-end-tax')
    else navigate('/info', { state: { scrollTo: 'calc' } })
  }

  return (
    <section
      aria-label="시작 가이드"
      className="rounded-card border-2 border-brand/40 bg-card px-4 py-3.5 shadow-card"
    >
      <div className="flex items-center justify-between">
        <p className="text-[14px] font-bold text-ink">우리집 가계부 시작하기</p>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold text-brand">
            {doneCount}/{START_STEPS.length}
          </span>
          <button
            onClick={() => {
              hideStartGuide()
              setHidden(true)
            }}
            aria-label="시작 가이드 닫기"
            className="text-cap active:text-sub"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-brand transition-all"
          style={{ width: `${Math.round((doneCount / START_STEPS.length) * 100)}%` }}
        />
      </div>

      <p className="mt-3 text-[11.5px] font-bold text-cap">지금 할 일</p>
      <p className="mt-0.5 text-[17px] font-extrabold text-ink">{current.label}</p>
      <p className="mt-0.5 text-[13px] leading-relaxed text-sub">{current.hint}</p>
      <button
        onClick={() => go(current.key)}
        className="mt-3 h-11 w-full rounded-btn bg-brand text-[14px] font-bold text-white active:bg-brand-dark"
      >
        {current.cta}
      </button>

      <div className="mt-3 border-t border-line pt-1.5">
        {START_STEPS.filter((s) => s.key !== current.key).map((s) => {
          const n = START_STEPS.indexOf(s) + 1
          return (
            <button
              key={s.key}
              onClick={() => go(s.key)}
              className="flex w-full items-center gap-2.5 py-1.5 text-left active:opacity-60"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  done[s.key] ? 'bg-brand text-white' : 'bg-bg text-cap'
                }`}
              >
                {done[s.key] ? <Check size={12} /> : n}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-[13px] ${
                  done[s.key] ? 'text-cap line-through' : 'text-sub'
                }`}
              >
                {s.label}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
