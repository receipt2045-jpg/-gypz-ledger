import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { BudgetItem } from '../types'
import { effectiveAmount } from '../lib/carryover'
import { formatComma, formatWon } from '../lib/format'

interface SectionListProps {
  title: string
  items: BudgetItem[]
  closed: boolean
  goodWhenOver: boolean // 수입/저축/투자는 초과가 좋음(파랑), 지출은 반대
  memberNames: [string, string]
}

export default function SectionList({
  title,
  items,
  closed,
  goodWhenOver,
  memberNames,
}: SectionListProps) {
  // 처음엔 접어 둔다 — 위의 '한눈에'가 먼저 보이게 (2026-10-07)
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null

  const subtotal = items.reduce((acc, it) => acc + effectiveAmount(it, closed), 0)

  return (
    <div className="rounded-card bg-card px-5 py-4 shadow-card">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between"
      >
        <h3 className="text-[15px] font-bold text-ink">
          {title} <span className="text-[13px] font-medium text-cap">{items.length}건</span>
        </h3>
        <span className="tnum flex items-center gap-1 text-[15px] font-bold text-ink">
          {formatWon(subtotal)}
          {open ? (
            <ChevronDown size={16} className="text-cap" />
          ) : (
            <ChevronRight size={16} className="text-cap" />
          )}
        </span>
      </button>
      {open && (
        <div className="mt-1 divide-y divide-line/70">
          {items.map((it) => {
            const main = effectiveAmount(it, closed)
            const diff = it.actual - it.planned
            const good = goodWhenOver ? diff >= 0 : diff <= 0
            const diffColor = good ? 'text-brand' : 'text-danger'
            return (
              <div key={it.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-ink">{it.category}</p>
                  <p className="mt-0.5 truncate text-[12px] text-cap">
                    {it.shared ? '공동' : memberNames[it.member - 1]}
                    {it.note ? ` · ${it.note}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-[15px] font-semibold text-ink">{formatComma(main)}원</p>
                  {closed ? (
                    diff !== 0 ? (
                      <p className={`tnum mt-0.5 text-[12px] font-medium ${diffColor}`}>
                        예산 대비 {diff > 0 ? '+' : '−'}
                        {formatComma(Math.abs(diff))}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[12px] text-cap">예산과 동일</p>
                    )
                  ) : (
                    <p className="tnum mt-0.5 text-[12px] text-cap">
                      계획 {formatComma(it.planned)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
