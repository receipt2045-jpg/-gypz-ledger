import { useState } from 'react'
import { Calculator } from 'lucide-react'
import CalcPad from './CalcPad'
import { evaluate, isExpr } from '../lib/calc'
import { formatComma, parseNumber } from '../lib/format'

interface AmountInputProps {
  value: number
  onChange: (n: number) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  suffix?: string
  error?: boolean // 검증 실패 시 강조 (브리프 P1 2.2)
}

/**
 * 천 단위 콤마 자동 포맷 금액 입력 (음수·비숫자 차단).
 * 계산기(2026-10-07): 옆 버튼으로 계산기 창을 열거나, "38000+12500"처럼 식을 치면
 * 칸을 떠날 때(또는 Enter) 계산한 값이 들어간다.
 */
export default function AmountInput({
  value,
  onChange,
  placeholder = '0',
  autoFocus,
  className = '',
  suffix = '원',
  error = false,
}: AmountInputProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const [calcOpen, setCalcOpen] = useState(false)
  const display = draft ?? (value === 0 ? '' : formatComma(value))
  const preview = draft !== null ? evaluate(draft) : null

  const commit = () => {
    if (draft === null) return
    const v = evaluate(draft)
    if (v !== null) onChange(Math.max(0, v))
    setDraft(null)
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className={`flex items-center gap-1 rounded-btn border bg-white pl-3.5 pr-2.5 focus-within:border-brand ${
          error ? 'border-danger' : 'border-line'
        }`}
      >
        <input
          type="text"
          inputMode="numeric"
          autoFocus={autoFocus}
          value={display}
          placeholder={placeholder}
          onChange={(e) => {
            const raw = e.target.value
            if (isExpr(raw)) return setDraft(raw)
            setDraft(null)
            onChange(Math.max(0, parseNumber(raw)))
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft !== null) {
              e.preventDefault()
              commit()
            }
          }}
          className="tnum min-w-0 w-full bg-transparent py-3 text-right text-[17px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-cap"
        />
        <span className="shrink-0 text-[15px] font-medium text-sub">{suffix}</span>
        <button
          type="button"
          onClick={() => setCalcOpen(true)}
          aria-label="계산기"
          className="-mr-0.5 shrink-0 rounded-md p-1 text-cap active:bg-bg active:text-brand"
        >
          <Calculator size={16} />
        </button>
      </div>
      {draft !== null && (
        <p className="tnum absolute right-1 top-full z-10 mt-0.5 rounded bg-white/95 px-1 text-[12px] font-bold text-brand">
          {preview !== null
            ? `= ${formatComma(Math.max(0, preview))}${suffix}`
            : '계산식을 마저 써 주세요'}
        </p>
      )}
      {calcOpen && (
        <CalcPad
          initial={value}
          suffix={suffix}
          onClose={() => setCalcOpen(false)}
          onDone={(n) => {
            onChange(n)
            setCalcOpen(false)
          }}
        />
      )}
    </div>
  )
}
