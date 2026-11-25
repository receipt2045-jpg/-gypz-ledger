import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { BudgetItem } from '../types'
import { effectiveAmount } from '../lib/carryover'
import { formatComma, formatWon } from '../lib/format'
import SheetTable from './SheetTable'

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
  const whoOf = (it: BudgetItem) => (it.shared ? '공동' : memberNames[it.member - 1])

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
      {/* 엑셀처럼 표로 (2026-11-25 결영 요청) — 칸 이름 옆 ▾ 거르기 */}
      {open && (
        <div className="mt-2">
          <SheetTable
            rows={items}
            rowKey={(it) => it.id}
            minWidth={460}
            cols={[
              {
                key: 'category',
                label: '항목',
                width: 110,
                cell: (it) => it.category,
                filter: { get: (it) => it.category },
              },
              {
                key: 'who',
                label: '누구',
                width: 76,
                align: 'center',
                cell: (it) => whoOf(it),
                filter: { get: (it) => whoOf(it) },
              },
              {
                key: 'note',
                label: '메모',
                cell: (it) => it.note ?? '',
                tone: () => 'text-sub',
                filter: { get: (it) => it.note ?? '', text: true },
              },
              {
                key: 'amount',
                label: closed ? '실제' : '금액',
                width: 96,
                align: 'right',
                cell: (it) => formatComma(effectiveAmount(it, closed)),
                tone: () => 'font-semibold text-ink tnum',
              },
              {
                key: 'diff',
                label: closed ? '예산 대비' : '계획',
                width: 92,
                align: 'right',
                cell: (it) => {
                  const diff = it.actual - it.planned
                  if (!closed) return formatComma(it.planned)
                  if (diff === 0) return '같음'
                  return `${diff > 0 ? '+' : '−'}${formatComma(Math.abs(diff))}`
                },
                tone: (it) => {
                  const diff = it.actual - it.planned
                  if (!closed || diff === 0) return 'text-cap tnum'
                  const good = goodWhenOver ? diff >= 0 : diff <= 0
                  return `tnum font-medium ${good ? 'text-brand' : 'text-danger'}`
                },
              },
            ]}
            summary={(rows) => (
              <b className="text-ink">
                {formatWon(rows.reduce((a, it) => a + effectiveAmount(it, closed), 0))}
              </b>
            )}
          />
        </div>
      )}
    </div>
  )
}
