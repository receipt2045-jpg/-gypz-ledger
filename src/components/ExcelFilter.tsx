import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Filter } from 'lucide-react'

/**
 * 엑셀처럼 거르기 (2026-11-25 결영 요청: "필터는 엑셀처럼 보이게 넣어").
 * 칸 이름 옆 ▾를 누르면 그 칸에 있는 값이 체크 목록으로 뜨고, 고른 것만 남긴다.
 * 메모처럼 값이 제각각인 칸은 '이 말이 들어간 것만'.
 * 거르는 칸은 ▾ 대신 깔때기 표시 — 엑셀과 같다.
 */

export interface FilterOption {
  value: string
  label: string
  count: number
}
export interface FilterColumn {
  key: string
  label: string
  /** 없으면 글자로 찾는 칸 */
  options?: FilterOption[]
}
/** 칸마다: 고른 값들(Set) / 찾는 말(string) / 안 거름(없음) */
export type FilterState = Record<string, Set<string> | string | undefined>

const on = (v: Set<string> | string | undefined) =>
  v !== undefined && (typeof v === 'string' ? v.trim() !== '' : true)

/** 무엇이든 거르는 중인지 */
export const isFilterOn = (st: FilterState) => Object.values(st).some(on)

/** 이 줄이 거르기를 통과하는지 */
export function passes<T>(st: FilterState, get: Record<string, (r: T) => string>, r: T) {
  for (const [k, v] of Object.entries(st)) {
    if (!on(v) || !get[k]) continue
    const val = get[k](r)
    if (typeof v === 'string') {
      if (!val.toLowerCase().includes(v.trim().toLowerCase())) return false
    } else if (!v!.has(val)) return false
  }
  return true
}

/** 칸에 있는 값 목록 — 값 순서대로, 몇 건인지 */
export function optionsOf<T>(rows: T[], get: (r: T) => string, label: (v: string) => string) {
  const m = new Map<string, number>()
  for (const r of rows) m.set(get(r), (m.get(get(r)) ?? 0) + 1)
  return [...m.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([value, count]) => ({ value, label: label(value) || '(빈 칸)', count }))
}

/** 칸 이름 + ▾ 버튼. 누르면 거르기 창 */
export function FilterHead({
  col,
  value,
  onChange,
}: {
  col: FilterColumn
  value: Set<string> | string | undefined
  onChange: (v: Set<string> | string | undefined) => void
}) {
  const btn = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const active = on(value)
  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${col.label} 거르기`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-1 text-left"
      >
        <span className={`truncate ${active ? 'text-brand' : ''}`}>{col.label}</span>
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ${
            active ? 'border-brand bg-brand/10 text-brand' : 'border-line bg-white text-cap'
          }`}
        >
          {active ? <Filter size={9} strokeWidth={2.5} /> : <ChevronDown size={11} />}
        </span>
      </button>
      {open && btn.current && (
        <FilterPop
          anchor={btn.current}
          col={col}
          value={value}
          onClose={() => setOpen(false)}
          onApply={(v) => {
            onChange(v)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}

function FilterPop({
  anchor,
  col,
  value,
  onClose,
  onApply,
}: {
  anchor: HTMLElement
  col: FilterColumn
  value: Set<string> | string | undefined
  onClose: () => void
  onApply: (v: Set<string> | string | undefined) => void
}) {
  const opts = col.options
  const [text, setText] = useState(typeof value === 'string' ? value : '')
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState<Set<string>>(() =>
    value instanceof Set ? new Set(value) : new Set((opts ?? []).map((o) => o.value)),
  )
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const r = anchor.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.visualViewport?.height ?? window.innerHeight
  const W = Math.min(260, vw - 16)
  const H = opts ? 330 : 150
  const top = r.bottom + 4 + H <= vh ? r.bottom + 4 : Math.max(8, r.top - 4 - H)
  const left = Math.max(8, Math.min(r.left, vw - W - 8))

  const q = search.trim().toLowerCase()
  const visible = (opts ?? []).filter((o) => !q || o.label.toLowerCase().includes(q))
  const allOn = visible.length > 0 && visible.every((o) => picked.has(o.value))
  const toggle = (v: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(v)) n.delete(v)
      else n.add(v)
      return n
    })
  const toggleAll = () =>
    setPicked((p) => {
      const n = new Set(p)
      for (const o of visible) {
        if (allOn) n.delete(o.value)
        else n.add(o.value)
      }
      return n
    })
  const apply = () => {
    if (!opts) return onApply(text.trim() ? text.trim() : undefined)
    // 검색해서 고르면 엑셀처럼 보이는 것 중 고른 것만
    const chosen = q
      ? new Set(visible.filter((o) => picked.has(o.value)).map((o) => o.value))
      : picked
    onApply(chosen.size === opts.length ? undefined : chosen)
  }
  const canApply = !opts || (q ? visible.some((o) => picked.has(o.value)) : picked.size > 0)

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label={`${col.label} 거르기 창`}
        style={{ position: 'fixed', top, left, width: W }}
        className="z-50 rounded-btn border border-line bg-white p-2.5 text-[13px] shadow-card"
      >
        <p className="mb-1.5 text-[12px] font-bold text-sub">{col.label}</p>
        {opts ? (
          <>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="검색"
              aria-label={`${col.label} 값 검색`}
              className="w-full rounded-[6px] border border-line px-2 py-1.5 text-[13px] outline-none focus:border-brand"
            />
            <div className="mt-1.5 max-h-[200px] overflow-y-auto rounded-[6px] border border-line py-1">
              <label className="flex cursor-pointer items-center gap-2 px-2 py-1 active:bg-bg">
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={toggleAll}
                  className="h-4 w-4 accent-[#3182F6]"
                />
                <span className="text-ink">(모두 선택)</span>
              </label>
              {visible.map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-2 px-2 py-1 active:bg-bg"
                >
                  <input
                    type="checkbox"
                    checked={picked.has(o.value)}
                    onChange={() => toggle(o.value)}
                    className="h-4 w-4 shrink-0 accent-[#3182F6]"
                  />
                  <span className="min-w-0 flex-1 truncate text-ink">{o.label}</span>
                  <span aria-hidden className="tnum shrink-0 text-[11.5px] text-cap">
                    {o.count}
                  </span>
                </label>
              ))}
              {visible.length === 0 && (
                <p className="px-2 py-1 text-[12px] text-cap">맞는 값이 없어요</p>
              )}
            </div>
          </>
        ) : (
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && apply()}
            placeholder="이 말이 들어간 것만"
            aria-label={`${col.label} 찾는 말`}
            autoFocus
            className="w-full rounded-[6px] border border-line px-2 py-1.5 text-[13px] outline-none focus:border-brand"
          />
        )}
        <div className="mt-2 flex items-center gap-1.5">
          {on(value) && (
            <button
              type="button"
              onClick={() => onApply(undefined)}
              className="text-[12px] font-bold text-sub active:text-ink"
            >
              필터 지우기
            </button>
          )}
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-line px-3 py-1 text-[12.5px] font-bold text-sub active:bg-bg"
          >
            취소
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!canApply}
            className="rounded-[6px] bg-brand px-3 py-1 text-[12.5px] font-bold text-white disabled:opacity-40"
          >
            확인
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}

/** 표가 없는 화면(목록·달력)용 — 엑셀 머리줄처럼 칸 이름 + ▾ 를 한 줄로 */
export function FilterStrip({
  cols,
  state,
  onChange,
}: {
  cols: FilterColumn[]
  state: FilterState
  onChange: (st: FilterState) => void
}) {
  return (
    <div
      className="grid overflow-hidden rounded-[6px] border border-line/80 bg-bg text-[11.5px] font-bold text-sub"
      style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}
    >
      {cols.map((c) => (
        <div key={c.key} className="border-r border-line/80 px-2 py-1.5 last:border-r-0">
          <FilterHead
            col={c}
            value={state[c.key]}
            onChange={(v) => onChange({ ...state, [c.key]: v })}
          />
        </div>
      ))}
    </div>
  )
}
