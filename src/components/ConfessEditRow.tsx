import { useState } from 'react'
import { formatComma } from '../lib/format'
import { GROUP_LABEL } from '../lib/constants'
import type { CategoryGroup, Confession } from '../types'

/** 기록 한 건에 붙는 메모 (2026-11-24: 40자 → 100자) */
export const NOTE_MAX = 100

/**
 * 기록 고치기 — 금액·항목·메모.
 * 제보 4건(8/9, 8/11×2, 9/9): "잘못 썼을 때 삭제하고 다시 작성하는 게 번거로워요".
 * 누가 썼는지·날짜는 여기서 안 바꾼다 — 그건 지우고 다시 적는 편이 헷갈리지 않는다.
 */
export default function EditRow({
  c,
  categories,
  memberNames,
  onSave,
  onCancel,
}: {
  c: Confession
  categories: Record<CategoryGroup, string[]>
  memberNames: [string, string]
  onSave: (patch: {
    amount: number
    category: string
    kind: CategoryGroup
    note?: string
    createdAt?: string
    memberNo: 1 | 2
    shared?: boolean
    cardOwner?: 1 | 2
    cash?: boolean
  }) => void
  onCancel: () => void
}) {
  const [amount, setAmount] = useState(c.amount)
  const [pick, setPick] = useState(`${c.kind}:${c.category}`)
  const [note, setNote] = useState(c.note ?? '')
  // 날짜도 고친다 (2026-10-21 의견: "가계부 내역 수정할 때 날짜도 수정할 수 있으면 좋겠습니다")
  const origDate = new Date(c.createdAt).toLocaleDateString('sv-SE')
  const [date, setDate] = useState(origDate)
  const today = new Date().toLocaleDateString('sv-SE')
  const groups: CategoryGroup[] = ['variable', 'fixed', 'income', 'saving', 'investment']
  // 누가 썼는지·어떻게 냈는지 (2026-10-27 의견: "공동 생활비인데 아내로 눌러서 쓰고 나면 다시 공동으로 바꿀 수 있나요?")
  // 공동은 memberNo(적은 사람)를 그대로 두고 표시만 — 새로 적을 때와 같은 규칙
  const [who, setWho] = useState<1 | 2 | 'shared'>(c.shared ? 'shared' : c.memberNo)
  const [paid, setPaid] = useState<1 | 2 | 'cash' | null>(c.cash ? 'cash' : (c.cardOwner ?? null))
  const kind = pick.slice(0, pick.indexOf(':')) as CategoryGroup
  const isSpend = kind === 'variable' || kind === 'fixed'

  const save = () => {
    const i = pick.indexOf(':')
    onSave({
      memberNo: who === 'shared' ? c.memberNo : who,
      shared: who === 'shared' ? true : undefined,
      // 카드값이 아닌 것(저축·투자·수입)에는 카드 주인을 남기지 않는다
      cardOwner: isSpend && paid !== null && paid !== 'cash' ? paid : undefined,
      cash: isSpend && paid === 'cash' ? true : undefined,
      kind: pick.slice(0, i) as CategoryGroup,
      category: pick.slice(i + 1),
      amount,
      note: note.trim() || undefined,
      // 바꾼 날은 그 날 낮 12시로 — 새로 적을 때와 같은 규칙 (시간대가 밀려 하루 어긋나지 않게)
      ...(date && date !== origDate
        ? { createdAt: new Date(`${date}T12:00:00`).toISOString() }
        : {}),
    })
  }

  return (
    <div className="space-y-2 rounded-btn bg-bg px-3 py-3">
      <div className="flex items-center gap-2">
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          aria-label="항목"
          className="min-w-0 flex-1 rounded-btn border border-line bg-white px-2 py-1.5 text-[14px] font-bold text-ink outline-none focus:border-brand"
        >
          {groups.map((g) => (
            <optgroup key={g} label={GROUP_LABEL[g]}>
              {/* 지금 항목이 카테고리 목록에서 빠졌어도(지운 카테고리) 고르던 값은 남긴다 */}
              {(g === c.kind && !categories[g].includes(c.category)
                ? [c.category, ...categories[g]]
                : categories[g]
              ).map((cat) => (
                <option key={`${g}:${cat}`} value={`${g}:${cat}`}>
                  {cat}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <input
          inputMode="numeric"
          aria-label="금액"
          value={formatComma(amount)}
          onChange={(e) =>
            setAmount(Math.min(Number(e.target.value.replace(/[^\d]/g, '')) || 0, 999_999_999))
          }
          className="tnum w-28 shrink-0 rounded-btn border border-line bg-white px-2 py-1.5 text-right text-[15px] font-bold text-ink outline-none focus:border-brand"
        />
        <span className="text-[13px] text-sub">원</span>
      </div>
      <div className="flex items-center gap-2 text-[13px] text-sub">
        <span className="w-[52px] shrink-0">누가</span>
        <div className="flex flex-1 gap-1.5">
          {([1, 2, 'shared'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setWho(m)}
              aria-label={`누가 쓴 돈: ${m === 'shared' ? '공동' : memberNames[m - 1]}`}
              aria-pressed={who === m}
              className={`min-w-0 flex-1 truncate rounded-btn py-1.5 text-[12.5px] font-bold ${
                who === m ? 'bg-brand text-white' : 'bg-white text-sub'
              }`}
            >
              {m === 'shared' ? '공동' : memberNames[m - 1]}
            </button>
          ))}
        </div>
      </div>
      {isSpend && (
        <div className="flex items-center gap-2 text-[13px] text-sub">
          <span className="w-[52px] shrink-0">어떻게</span>
          <div className="flex flex-1 gap-1.5">
            {([1, 2, 'cash'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPaid(paid === m ? null : m)}
                aria-label={`어떻게 냈나: ${m === 'cash' ? '현금' : `${memberNames[m - 1]} 카드`}`}
                aria-pressed={paid === m}
                className={`min-w-0 flex-1 truncate rounded-btn py-1.5 text-[12.5px] font-bold ${
                  paid === m ? 'bg-ink text-white' : 'bg-white text-sub'
                }`}
              >
                {m === 'cash' ? '현금' : `${memberNames[m - 1]} 카드`}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 text-[13px] text-sub">
        <span className="shrink-0">날짜</span>
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          aria-label="날짜"
          className="tnum min-w-0 flex-1 rounded-btn border border-line bg-white px-2 py-1.5 text-[13px] font-bold text-ink outline-none focus:border-brand"
        />
      </label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="메모 (선택)"
        aria-label="메모"
        maxLength={NOTE_MAX}
        className="w-full rounded-btn border border-line bg-white px-3 py-1.5 text-[13px] text-ink outline-none focus:border-brand placeholder:text-cap"
      />
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="h-9 flex-1 rounded-btn bg-white text-[13px] font-bold text-sub active:bg-line"
        >
          그대로 두기
        </button>
        <button
          onClick={save}
          className="h-9 flex-1 rounded-btn bg-brand text-[13px] font-bold text-white active:bg-brand-dark"
        >
          고치기
        </button>
      </div>
    </div>
  )
}
