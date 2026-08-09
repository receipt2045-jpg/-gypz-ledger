import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { abbreviateKRW, formatWon } from '../lib/format'
import {
  buildFixedCostReport,
  headlineOf,
  type CategoryVerdict,
} from '../lib/fixedCostBenchmark'
import type { BudgetItem } from '../types'

/**
 * 고정비 점검 — "우리집 고정비, 이만하면 괜찮은 걸까?"에 답하는 카드.
 *
 * 상위 몇 %라고 줄 세우지 않는다. 줄일 수 있는 금액과 그 돈의 10년치를
 * 보여줘서, 비교가 잔소리가 아니라 행동으로 이어지게 한다.
 */
export default function FixedCostCheck({
  items,
  closed,
}: {
  items: BudgetItem[]
  closed: boolean
}) {
  const [open, setOpen] = useState(false)
  const r = buildFixedCostReport(items, closed)

  if (r.categories.length === 0) return null

  return (
    <div className="rounded-card bg-card px-5 py-4 shadow-card">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-ink">고정비 점검</h3>
        {r.totalStatus !== 'unknown' && (
          <span className="tnum text-[13px] font-bold text-sub">
            수입의 {Math.round(r.totalRatio * 100)}%
          </span>
        )}
      </div>
      <p className="text-[12.5px] leading-relaxed text-sub">{headlineOf(r)}</p>

      {/* 줄일 여지가 있으면 10년치로 환산해서 먼저 보여준다 */}
      {r.totalOverBy > 0 && (
        <div className="mt-3 rounded-btn bg-brand/10 px-3.5 py-3">
          <p className="text-[13px] font-bold text-brand">
            매달 {formatWon(r.totalOverBy)} 줄일 여지가 있어요
          </p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-sub">
            이 돈을 10년 모으면 <b className="text-ink">{abbreviateKRW(r.tenYearTotal)}</b>이에요
          </p>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {r.categories.map((c) => (
          <Row key={c.category} v={c} />
        ))}
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-3 flex w-full items-center justify-center gap-1 text-[12px] font-semibold text-cap active:text-sub"
      >
        기준이 궁금하다면
        <ChevronDown size={13} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 border-t border-line pt-2.5">
          {r.categories
            .filter((c) => c.band)
            .map((c) => (
              <p key={c.category} className="text-[11.5px] leading-relaxed text-cap">
                <b className="font-semibold text-sub">{c.category}</b> · {c.band!.source}
              </p>
            ))}
          <p className="pt-1 text-[11.5px] leading-relaxed text-cap">
            널리 쓰이는 눈금이지 정답은 아니에요. 우리집 사정이 먼저입니다.
          </p>
        </div>
      )}
    </div>
  )
}

function Row({ v }: { v: CategoryVerdict }) {
  const pct = Math.round(v.ratio * 100)
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[14px] font-semibold text-ink">{v.category}</span>
        {v.status === 'ok' && <Check size={13} className="shrink-0 text-brand" />}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="tnum text-[13.5px] font-semibold text-ink">{formatWon(v.amount)}</span>
        {v.status === 'unknown' ? (
          <span className="w-[62px] text-right text-[11.5px] text-cap">기준 없음</span>
        ) : (
          <span
            className={`tnum w-[62px] text-right text-[12px] font-bold ${
              v.status === 'over' ? 'text-danger' : 'text-cap'
            }`}
          >
            수입의 {pct}%
          </span>
        )}
      </div>
    </div>
  )
}
