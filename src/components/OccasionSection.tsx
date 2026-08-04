import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import AmountInput from './AmountInput'
import { formatWon } from '../lib/format'
import { OCCASION_CATEGORIES } from '../lib/constants'
import type { OccasionEntry } from '../types'

/**
 * 비정기 지출 목록/입력.
 * - 가계부 탭: onAdd를 넘겨 입력 가능 (기록은 지출이 생긴 그 달에 한다)
 * - 연간 리포트: onAdd 없이 조회·삭제만 (연간 합계 확인용)
 */
export default function OccasionSection({
  items,
  yearTotal,
  defaultDate,
  onAdd,
  onRemove,
  emptyText = '아직 기록이 없어요 · 예산이 무너지는 1위가 비정기 지출이에요',
}: {
  items: OccasionEntry[]
  yearTotal: number
  defaultDate?: string
  onAdd?: (e: Omit<OccasionEntry, 'id'>) => void
  onRemove: (id: string) => void
  emptyText?: string
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(defaultDate ?? '')
  const [category, setCategory] = useState(OCCASION_CATEGORIES[0])
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState(0)

  const submit = () => {
    if (!onAdd || !title.trim() || amount <= 0 || !date) return
    onAdd({ date, category, title: title.trim(), amount })
    setTitle('')
    setAmount(0)
    setOpen(false)
  }

  return (
    <div className="rounded-card bg-card px-5 py-4 shadow-card">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-ink">비정기 지출</h2>
        {onAdd && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-[12px] font-bold text-brand"
          >
            <Plus size={14} /> 추가
          </button>
        )}
      </div>
      <p className="mb-2 text-[12px] text-cap">
        경조사·명절·자동차·세금처럼 <b className="font-semibold">가끔 오는 큰돈</b> · 공동 카드 지출도
        여기에 · 올해 합계{' '}
        <span className="tnum font-semibold text-sub">{formatWon(yearTotal)}</span>
      </p>
      {!onAdd && (
        <p className="mb-2 text-[12px] text-cap">기록은 가계부 탭에서 해요 · 여기선 한눈에 봅니다</p>
      )}

      {onAdd && open && (
        <div className="mb-3 space-y-2 rounded-btn bg-bg p-3">
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="tnum flex-1 rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand"
            >
              {OCCASION_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="내용 (예: 친구 결혼식)"
            className="w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand placeholder:text-cap"
          />
          <AmountInput value={amount} onChange={setAmount} placeholder="금액" />
          <button
            onClick={submit}
            className="h-11 w-full rounded-btn bg-brand text-[15px] font-bold text-white active:bg-brand-dark"
          >
            추가하기
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-3 text-center text-[13px] text-cap">{emptyText}</p>
      ) : (
        <div className="divide-y divide-line/70">
          {items.map((o) => (
            <div key={o.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-medium text-ink">{o.title}</p>
                <p className="mt-0.5 text-[12px] text-cap">
                  {o.date.replace(/-/g, '.')} · {o.category}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="tnum text-[15px] font-semibold text-ink">
                  {formatWon(o.amount)}
                </span>
                <button
                  onClick={() => onRemove(o.id)}
                  className="text-cap active:text-danger"
                  aria-label="삭제"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
