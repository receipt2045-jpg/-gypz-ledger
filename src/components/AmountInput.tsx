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

/** 천 단위 콤마 자동 포맷 금액 입력 (음수·비숫자 차단) */
export default function AmountInput({
  value,
  onChange,
  placeholder = '0',
  autoFocus,
  className = '',
  suffix = '원',
  error = false,
}: AmountInputProps) {
  const display = value === 0 ? '' : formatComma(value)

  return (
    <div
      className={`flex items-center gap-1 rounded-btn border bg-white px-3.5 focus-within:border-brand ${
        error ? 'border-danger' : 'border-line'
      } ${className}`}
    >
      <input
        type="text"
        inputMode="numeric"
        autoFocus={autoFocus}
        value={display}
        placeholder={placeholder}
        onChange={(e) => onChange(Math.max(0, parseNumber(e.target.value)))}
        className="tnum w-full bg-transparent py-3 text-right text-[17px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-cap"
      />
      <span className="shrink-0 text-[15px] font-medium text-sub">{suffix}</span>
    </div>
  )
}
