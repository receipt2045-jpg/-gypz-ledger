import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import {
  FilterHead,
  isFilterOn,
  optionsOf,
  passes,
  type FilterColumn,
  type FilterState,
} from './ExcelFilter'

/**
 * 엑셀처럼 보는 표 — 여러 화면이 같이 쓴다 (2026-11-25 결영 요청:
 * "내가 기록한 거 목록으로 보이는 곳" → 비정기 지출·정산 내역·항목별 내역·아이 통장·자산 등록·주식 일지).
 * 머리줄 칸 이름 옆 ▾ = 거르기(체크 목록 / 글자 찾기). 줄을 누르면 onRowClick, 고치는 줄은 renderEdit로 칸 전체를 쓴다.
 */
export interface SheetCol<T> {
  key: string
  label: string
  /** px — 없으면 남는 폭 */
  width?: number
  align?: 'left' | 'center' | 'right'
  cell: (r: T) => ReactNode
  /** 칸 글자 꾸밈 */
  tone?: (r: T) => string
  /** 거르기 — 값 목록(get, label) 또는 글자로 찾기(text) */
  filter?: { get: (r: T) => string; label?: (v: string) => string; text?: boolean }
}

export default function SheetTable<T>({
  rows,
  cols,
  rowKey,
  onRowClick,
  rowLabel,
  editingKey,
  renderEdit,
  onRemove,
  removeConfirm,
  removeLabel = '삭제',
  rowClass,
  minWidth = 520,
  bleed = 'px-5 -mx-5',
  summary,
  empty,
  filter: filterProp,
  onFilter: onFilterProp,
}: {
  rows: T[]
  cols: SheetCol<T>[]
  rowKey: (r: T) => string
  /** 줄을 누르면 */
  onRowClick?: (r: T) => void
  /** 줄 누르기 버튼 이름 — 화면 읽기·테스트용 (예: '식비 기록 고치기') */
  rowLabel?: (r: T) => string
  editingKey?: string | null
  renderEdit?: (r: T) => ReactNode
  /** 휴지통 칸 — 묻고 지운다 */
  onRemove?: (r: T) => void
  removeConfirm?: (r: T) => string
  /** 휴지통 버튼 이름 */
  removeLabel?: string
  rowClass?: (r: T) => string
  minWidth?: number
  /** 카드 안쪽 여백만큼 표를 옆으로 넓힌다 */
  bleed?: string
  /** 거르는 중일 때 '필터 걸림 N건' 옆에 붙는 글 (합계 등) */
  summary?: (shown: T[]) => ReactNode
  empty?: ReactNode
  filter?: FilterState
  onFilter?: (st: FilterState) => void
}) {
  const [selfF, setSelfF] = useState<FilterState>({})
  // 고치는 줄은 표 폭이 아니라 보이는 폭만큼 — 폰에서 표가 옆으로 길면 고치기 칸이 화면 밖으로 밀렸다
  const boxRef = useRef<HTMLDivElement>(null)
  const [boxW, setBoxW] = useState<number | null>(null)
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => {
      const cs = getComputedStyle(el)
      setBoxW(
        el.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0'),
      )
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])
  const filter = filterProp ?? selfF
  const setFilter = onFilterProp ?? setSelfF
  const get = Object.fromEntries(
    cols.filter((c) => c.filter).map((c) => [c.key, c.filter!.get]),
  ) as Record<string, (r: T) => string>
  const fcols: Record<string, FilterColumn> = Object.fromEntries(
    cols
      .filter((c) => c.filter)
      .map((c) => [
        c.key,
        c.filter!.text
          ? { key: c.key, label: c.label }
          : {
              key: c.key,
              label: c.label,
              options: optionsOf(rows, c.filter!.get, c.filter!.label ?? ((v) => v)),
            },
      ]),
  )
  const shown = rows.filter((r) => passes(filter, get, r))
  const filtering = isFilterOn(filter)
  const align = (a?: SheetCol<T>['align']) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left'
  const span = cols.length + (onRemove ? 1 : 0)
  const firstText = cols.findIndex((c) => c.align !== 'right' && c.align !== 'center')
  const cell = 'border-b border-r border-line/80 px-2'

  return (
    <div className="space-y-2">
      {filtering && (
        <p className="tnum flex items-center gap-2 rounded-btn bg-brand/5 px-3 py-2 text-[12.5px] text-sub">
          <span className="min-w-0 flex-1">
            필터 걸림 · <b className="text-ink">{shown.length}건</b>
            {summary && <> · {summary(shown)}</>}
          </span>
          <button
            onClick={() => setFilter({})}
            className="shrink-0 text-[12px] font-bold text-brand active:opacity-70"
          >
            필터 모두 지우기
          </button>
        </p>
      )}
      <div ref={boxRef} className={`no-scrollbar overflow-x-auto ${bleed}`}>
        <table className="w-full table-fixed border-collapse" style={{ minWidth }}>
          <colgroup>
            {cols.map((c) => (
              <col key={c.key} style={c.width ? { width: c.width } : undefined} />
            ))}
            {onRemove && <col style={{ width: 36 }} />}
          </colgroup>
          <thead>
            <tr className="bg-bg text-left text-[11.5px] font-bold text-sub">
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={`border-b border-r border-line/80 px-2 py-1.5 last:border-r-0 ${align(c.align)}`}
                >
                  {fcols[c.key] ? (
                    <FilterHead
                      col={fcols[c.key]}
                      value={filter[c.key]}
                      onChange={(v) => setFilter({ ...filter, [c.key]: v })}
                    />
                  ) : (
                    c.label
                  )}
                </th>
              ))}
              {onRemove && <th className="border-b border-line/80" />}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const k = rowKey(r)
              if (editingKey === k && renderEdit)
                return (
                  <tr key={k}>
                    <td colSpan={span} className="border-b border-line/80 px-1 py-1">
                      <div className="sticky left-0" style={boxW ? { width: boxW - 8 } : undefined}>
                        {renderEdit(r)}
                      </div>
                    </td>
                  </tr>
                )
              return (
                <tr
                  key={k}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={`h-10 text-[13px] ${onRowClick ? 'cursor-pointer active:bg-bg' : ''} ${rowClass?.(r) ?? ''}`}
                >
                  {cols.map((c, i) => (
                    <td
                      key={c.key}
                      className={`${cell} truncate ${align(c.align)} ${c.tone?.(r) ?? 'text-ink'}`}
                    >
                      {onRowClick && rowLabel && i === Math.max(0, firstText) ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRowClick(r)
                          }}
                          aria-label={rowLabel(r)}
                          className="block w-full truncate text-left"
                        >
                          {c.cell(r)}
                        </button>
                      ) : (
                        c.cell(r)
                      )}
                    </td>
                  ))}
                  {onRemove && (
                    <td className="border-b border-line/80 p-0 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!removeConfirm || window.confirm(removeConfirm(r))) onRemove(r)
                        }}
                        aria-label={removeLabel}
                        className="h-10 w-full text-cap active:text-danger"
                      >
                        <Trash2 size={14} className="mx-auto" />
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && empty}
      {rows.length > 0 && shown.length === 0 && (
        <p className="py-1 text-[13px] text-sub">고른 조건에 맞는 기록이 없어요</p>
      )}
    </div>
  )
}

/** '2026-11-03' → '11/3' */
export const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
