import { useState } from 'react'
import { Delete, X } from 'lucide-react'
import { evaluate, isExpr } from '../lib/calc'
import { formatComma } from '../lib/format'

const KEYS = [
  '7',
  '8',
  '9',
  '÷',
  '4',
  '5',
  '6',
  '×',
  '1',
  '2',
  '3',
  '−',
  '00',
  '0',
  '⌫',
  '+',
] as const
const OPS = new Set(['÷', '×', '−', '+'])

/**
 * 금액 계산기 창 (2026-10-07). 금액 칸 옆 계산기 버튼으로 연다.
 * 폰 숫자 자판엔 + − 가 없어서, 영수증 여러 장을 더할 때 따로 계산기 앱을 켜야 했다.
 */
export default function CalcPad({
  initial,
  suffix = '원',
  onDone,
  onClose,
}: {
  initial: number
  suffix?: string
  onDone: (n: number) => void
  onClose: () => void
}) {
  const [expr, setExpr] = useState(initial > 0 ? String(initial) : '')
  const result = evaluate(expr)

  const press = (k: (typeof KEYS)[number]) => {
    if (k === '⌫') return setExpr((e) => e.slice(0, -1))
    setExpr((e) => {
      // 기호 두 번이면 마지막 기호를 바꾼다 (12+× → 12×)
      if (OPS.has(k) && e && OPS.has(e.slice(-1))) return e.slice(0, -1) + k
      if (OPS.has(k) && !e) return e
      return e + k
    })
  }

  // 숫자 사이에 콤마를 넣어 보여준다 (38000+12500 → 38,000 + 12,500)
  const pretty = expr.replace(/\d+/g, (d) => formatComma(Number(d))).replace(/([÷×−+])/g, ' $1 ')

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 lg:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="계산기"
    >
      <div
        className="w-full max-w-app rounded-t-card bg-bg p-4 pb-6 lg:max-w-[400px] lg:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-bold text-ink">계산기</p>
          <button onClick={onClose} aria-label="닫기" className="text-cap">
            <X size={20} />
          </button>
        </div>
        <div className="mt-3 rounded-btn bg-white px-4 py-3 text-right">
          <p
            className="tnum min-h-[24px] break-all text-[17px] font-semibold text-ink"
            aria-label="계산식"
          >
            {pretty || '0'}
          </p>
          <p
            className="tnum mt-0.5 min-h-[20px] text-[14px] font-bold text-brand"
            aria-live="polite"
          >
            {isExpr(expr) && result !== null
              ? `= ${formatComma(Math.max(0, result))}${suffix}`
              : ''}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              aria-label={k === '⌫' ? '지우기' : k}
              className={`flex h-12 items-center justify-center rounded-btn text-[18px] font-semibold active:opacity-70 ${
                OPS.has(k) ? 'bg-brand/10 text-brand' : 'bg-white text-ink'
              }`}
            >
              {k === '⌫' ? <Delete size={20} /> : k}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setExpr('')}
            className="h-12 w-20 rounded-btn bg-white text-[14px] font-bold text-sub active:bg-line"
          >
            지우기
          </button>
          <button
            onClick={() => result !== null && onDone(Math.max(0, result))}
            disabled={result === null}
            className="h-12 flex-1 rounded-btn bg-brand text-[15px] font-bold text-white active:bg-brand-dark disabled:opacity-40"
          >
            {result !== null ? `${formatComma(Math.max(0, result))}${suffix} 넣기` : '넣기'}
          </button>
        </div>
      </div>
    </div>
  )
}
