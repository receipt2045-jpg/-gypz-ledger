import type { ComponentProps } from 'react'
import { Trash2 } from 'lucide-react'
import EditRow, { NOTE_MAX } from './ConfessEditRow'
import { DateCell, NumberCell, SelectCell, TextCell, noonOf, type CellOption } from './SheetCells'
import {
  FilterHead,
  isFilterOn,
  optionsOf,
  passes,
  type FilterColumn,
  type FilterState,
} from './ExcelFilter'
import { formatWon } from '../lib/format'
import { GROUP_LABEL } from '../lib/constants'
import { memberStyle } from '../lib/memberColors'
import type { CategoryGroup, Confession, Profile } from '../types'

/**
 * 소비 기록을 엑셀처럼 표로 (2026-11-25 결영 요청: "11월 소비 기록 목록 부분을 엑셀 형식으로",
 * 오늘의 소비 기록 '우리집 기록'도 "여기도").
 * 머리줄 칸 이름 옆 ▾ = 엑셀 거르기. 칸을 눌러 바로 고치고 (2026-11-26 "다른 표들도 칸에서 바로"),
 * 휴지통은 묻고 지운다.
 */

const dayOf = (c: { createdAt: string }) => new Date(c.createdAt).toLocaleDateString('sv-SE')

/** 칸마다 값 — 거르기 기준 */
export const confessGet: Record<string, (c: Confession) => string> = {
  date: dayOf,
  kind: (c) => c.kind,
  category: (c) => c.category,
  who: (c) => (c.child ? `child:${c.child}` : c.shared ? 'shared' : String(c.memberNo)),
  note: (c) => c.note ?? '',
}

export const filterConfessions = (rows: Confession[], st: FilterState) =>
  rows.filter((c) => passes(st, confessGet, c))

/** 거르기 칸 — 그 목록에 있는 값으로 */
export function confessCols(rows: Confession[], memberNames: [string, string]): FilterColumn[] {
  return [
    {
      key: 'date',
      label: '날짜',
      options: optionsOf(
        rows,
        confessGet.date,
        (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`,
      ),
    },
    {
      key: 'kind',
      label: '구분',
      options: optionsOf(rows, confessGet.kind, (k) => GROUP_LABEL[k as CategoryGroup] ?? k),
    },
    { key: 'category', label: '종류', options: optionsOf(rows, confessGet.category, (c) => c) },
    {
      key: 'who',
      label: '누가',
      options: optionsOf(rows, confessGet.who, (w) =>
        w.startsWith('child:')
          ? `🧒 ${w.slice(6)}`
          : w === 'shared'
            ? '공동'
            : memberNames[Number(w) - 1],
      ),
    },
    { key: 'note', label: '메모' },
  ]
}

/** 고른 기록 N건 · 쓴 돈 · 들어온 돈 · 필터 모두 지우기 */
export function FilterSummary({ rows, onClear }: { rows: Confession[]; onClear: () => void }) {
  const out = rows.filter((c) => c.kind !== 'income').reduce((a, c) => a + c.amount, 0)
  const inc = rows.filter((c) => c.kind === 'income').reduce((a, c) => a + c.amount, 0)
  return (
    <p className="tnum flex items-center gap-2 rounded-btn bg-brand/5 px-3 py-2 text-[12.5px] text-sub">
      <span className="min-w-0 flex-1">
        고른 기록 <b className="text-ink">{rows.length}건</b>
        {out > 0 && (
          <>
            {' '}
            · 쓴 돈 <b className="text-ink">{formatWon(out)}</b>
          </>
        )}
        {inc > 0 && (
          <>
            {' '}
            · 들어온 돈 <b className="text-brand">{formatWon(inc)}</b>
          </>
        )}
      </span>
      <button
        onClick={onClear}
        className="shrink-0 text-[12px] font-bold text-brand active:opacity-70"
      >
        필터 모두 지우기
      </button>
    </p>
  )
}

const GROUPS: CategoryGroup[] = ['variable', 'fixed', 'income', 'saving', 'investment']

/** 배지 색에서 글자색만 */
const textOf = (badge: string) =>
  badge
    .split(' ')
    .filter((k) => k.startsWith('text-'))
    .join(' ')

const KIND_TONE: Partial<Record<CategoryGroup, string>> = {
  income: 'text-brand',
  fixed: 'text-sub',
}

export default function ConfessTable({
  rows,
  filter,
  onFilter,
  showSummary = true,
  today,
  categories,
  memberNames,
  profile,
  onUpdate,
  onRemove,
}: {
  /** 거르기 전 목록 (새것부터) */
  rows: Confession[]
  filter: FilterState
  onFilter: (st: FilterState) => void
  /** 거르는 중일 때 '고른 기록' 줄 — 화면에서 따로 그리면 false */
  showSummary?: boolean
  /** 오늘 (YYYY-MM-DD) — 날짜 칸에 '오늘' */
  today: string
  categories: ComponentProps<typeof EditRow>['categories']
  memberNames: [string, string]
  profile: Profile
  onUpdate: (
    id: string,
    patch: Partial<Parameters<ComponentProps<typeof EditRow>['onSave']>[0]>,
  ) => void
  onRemove: (id: string) => void
}) {
  const cols = confessCols(rows, memberNames)
  const colOf = Object.fromEntries(cols.map((c) => [c.label, c]))
  const shown = filterConfessions(rows, filter)
  const filtering = isFilterOn(filter)
  const head = (label: string) =>
    colOf[label] ? (
      <FilterHead
        col={colOf[label]}
        value={filter[colOf[label].key]}
        onChange={(v) => onFilter({ ...filter, [colOf[label].key]: v })}
      />
    ) : (
      label
    )
  const cell = 'border-b border-r border-line/80 px-2'

  return (
    <div className="space-y-2">
      {showSummary && filtering && <FilterSummary rows={shown} onClear={() => onFilter({})} />}
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[710px] table-fixed border-collapse">
          <colgroup>
            <col className="w-[60px]" />
            <col className="w-[76px]" />
            <col className="w-[116px]" />
            <col className="w-[100px]" />
            <col className="w-[84px]" />
            <col className="w-[88px]" />
            <col />
            <col className="w-[36px]" />
          </colgroup>
          <thead>
            <tr className="bg-bg text-left text-[11.5px] font-bold text-sub">
              {['날짜', '구분', '종류', '금액', '누가', '결제', '메모', ''].map((h, i) => (
                <th
                  key={i}
                  className="border-b border-r border-line/80 px-2 py-1.5 last:border-r-0"
                >
                  {h ? head(h) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => {
              const day = dayOf(c)
              const spend = c.kind === 'variable' || c.kind === 'fixed'
              const catOpts: CellOption[] = GROUPS.flatMap((g) =>
                (g === c.kind && !categories[g].includes(c.category)
                  ? [c.category, ...categories[g]]
                  : categories[g]
                ).map((cat) => ({ value: `${g}:${cat}`, label: cat, group: GROUP_LABEL[g] })),
              )
              const paid = c.cash ? 'cash' : c.cardOwner ? String(c.cardOwner) : ''
              return (
                <tr
                  key={c.id}
                  className={`h-10 text-[13px] ${c.kind === 'income' ? 'bg-brand/[0.03]' : ''}`}
                >
                  <td className={`${cell} px-0.5 text-center`}>
                    <DateCell
                      label={`${c.category} 날짜`}
                      value={day}
                      max={today}
                      shown={
                        <span className="tnum text-sub">
                          {day === today
                            ? '오늘'
                            : `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`}
                        </span>
                      }
                      onCommit={(d) => onUpdate(c.id, { createdAt: noonOf(d) })}
                    />
                  </td>
                  <td
                    className={`${cell} truncate text-center font-semibold ${KIND_TONE[c.kind] ?? 'text-ink'}`}
                  >
                    {GROUP_LABEL[c.kind]}
                  </td>
                  <td className={`${cell} px-0.5`}>
                    <SelectCell
                      label={`${c.category} 종류`}
                      value={`${c.kind}:${c.category}`}
                      options={catOpts}
                      onChange={(v) => {
                        const i = v.indexOf(':')
                        const kind = v.slice(0, i) as CategoryGroup
                        const nowSpend = kind === 'variable' || kind === 'fixed'
                        onUpdate(c.id, {
                          kind,
                          category: v.slice(i + 1),
                          // 카드값이 아닌 것(저축·투자·수입)에는 카드 주인을 남기지 않는다
                          ...(nowSpend ? {} : { cardOwner: undefined, cash: undefined }),
                        })
                      }}
                      className="text-ink"
                    />
                  </td>
                  <td className={`${cell} px-0.5`}>
                    <NumberCell
                      label={`${c.category} 금액`}
                      value={c.amount}
                      prefix={
                        c.kind === 'income' ? <span className="font-bold text-brand">+</span> : null
                      }
                      onCommit={(v) => onUpdate(c.id, { amount: v })}
                      className={`font-bold ${c.kind === 'income' ? 'text-brand' : 'text-ink'}`}
                    />
                  </td>
                  <td className={`${cell} px-0.5 text-center`}>
                    {c.child ? (
                      <span className="inline-block max-w-full truncate rounded-full bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-700">
                        🧒 {c.child}
                      </span>
                    ) : (
                      <SelectCell
                        label={`${c.category} 누가`}
                        value={c.shared ? 'shared' : String(c.memberNo)}
                        options={[
                          { value: '1', label: memberNames[0] },
                          { value: '2', label: memberNames[1] },
                          { value: 'shared', label: '공동' },
                        ]}
                        // 공동은 memberNo(적은 사람)를 그대로 두고 표시만 — 새로 적을 때와 같은 규칙
                        onChange={(v) =>
                          onUpdate(
                            c.id,
                            v === 'shared'
                              ? { shared: true, memberNo: c.memberNo }
                              : { shared: undefined, memberNo: Number(v) as 1 | 2 },
                          )
                        }
                        className={`text-center font-bold ${c.shared ? 'text-sub' : textOf(memberStyle(c.memberNo, profile).badge)}`}
                      />
                    )}
                  </td>
                  <td className={`${cell} px-0.5`}>
                    {spend && (
                      <SelectCell
                        label={`${c.category} 결제`}
                        value={paid}
                        options={[
                          { value: '', label: '–' },
                          { value: '1', label: `${memberNames[0]} 카드` },
                          { value: '2', label: `${memberNames[1]} 카드` },
                          { value: 'cash', label: '현금' },
                        ]}
                        onChange={(v) =>
                          onUpdate(c.id, {
                            cash: v === 'cash' ? true : undefined,
                            cardOwner: v === '1' || v === '2' ? (Number(v) as 1 | 2) : undefined,
                          })
                        }
                        className="text-sub"
                      />
                    )}
                  </td>
                  <td className={`${cell} px-0.5`}>
                    <TextCell
                      label={`${c.category} 메모`}
                      value={c.note ?? ''}
                      placeholder="메모"
                      maxLength={NOTE_MAX}
                      onCommit={(v) => onUpdate(c.id, { note: v || undefined })}
                      className="text-sub"
                    />
                  </td>
                  <td className="border-b border-line/80 p-0 text-center">
                    <button
                      onClick={() => {
                        if (window.confirm(`${c.category} ${formatWon(c.amount)} 기록을 지울까요?`))
                          onRemove(c.id)
                      }}
                      aria-label="기록 삭제"
                      className="h-10 w-full text-cap active:text-danger"
                    >
                      <Trash2 size={14} className="mx-auto" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length > 0 && shown.length === 0 && (
        <p className="py-1 text-[13px] text-sub">고른 조건에 맞는 기록이 없어요</p>
      )}
    </div>
  )
}
