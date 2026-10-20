import { useState } from 'react'
import { Calculator } from 'lucide-react'
import CalcPad from './CalcPad'
import { evaluate, isExpr } from '../lib/calc'
import { abbreviateKRW, formatComma, parseNumber } from '../lib/format'

interface AmountInputProps {
  value: number
  onChange: (n: number) => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  suffix?: string
  error?: boolean // 검증 실패 시 강조 (브리프 P1 2.2)
  /**
   * 만원 단위로 받기 (2026-10-20 "40000000 입력하기 힘들어요") — 4000을 치면 4,000만원.
   * value·onChange는 그대로 원 단위. 1억 이상이면 칸 아래에 "2억 5,310만원"처럼 한글로도 보여 준다.
   */
  man?: boolean
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
  suffix,
  error = false,
  man = false,
}: AmountInputProps) {
  const scale = man ? 10_000 : 1
  const unit = suffix ?? (man ? '만원' : '원')
  const shown = Math.round(value / scale)
  const [draft, setDraft] = useState<string | null>(null)
  const [calcOpen, setCalcOpen] = useState(false)
  const display = draft ?? (shown === 0 ? '' : formatComma(shown))
  const preview = draft !== null ? evaluate(draft) : null

  const commit = () => {
    if (draft === null) return
    const v = evaluate(draft)
    if (v !== null) onChange(Math.max(0, v) * scale)
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
            onChange(Math.max(0, parseNumber(raw)) * scale)
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
        <span className="shrink-0 text-[15px] font-medium text-sub">{unit}</span>
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
            ? `= ${formatComma(Math.max(0, preview))}${unit}`
            : '계산식을 마저 써 주세요'}
        </p>
      )}
      {man && draft === null && value >= 100_000_000 && (
        <p className="tnum mt-1 pr-1 text-right text-[12px] font-medium text-sub">
          {abbreviateKRW(value)}
        </p>
      )}
      {calcOpen && (
        <CalcPad
          initial={shown}
          suffix={unit}
          onClose={() => setCalcOpen(false)}
          onDone={(n) => {
            onChange(n * scale)
            setCalcOpen(false)
          }}
        />
      )}
    </div>
  )
}
