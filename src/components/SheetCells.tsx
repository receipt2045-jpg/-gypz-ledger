import { useEffect, useState, type ReactNode } from 'react'

/**
 * 엑셀 표 칸 안에서 바로 고치는 입력칸들 (2026-11-26 결영 요청: "다른 표들도 칸에서 바로 고치게").
 * 테두리 없이 글자처럼 보이다가 누르면 파란 테두리. 글자·숫자 칸은 칸을 벗어나거나 Enter를 누를 때
 * 한 번만 저장한다 — 글자마다 저장하면 서버에 여러 번 간다. Esc는 원래대로.
 */
export const CELL_INPUT =
  'h-9 w-full min-w-0 rounded-[4px] bg-transparent px-1 text-[13px] outline-none focus:bg-brand/5 focus:ring-2 focus:ring-inset focus:ring-brand'

function useDraft<V>(value: V) {
  const [draft, setDraft] = useState(value)
  const [editing, setEditing] = useState(false)
  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])
  return { draft, setDraft, editing, setEditing }
}

/** 글자 칸 */
export function TextCell({
  label,
  value,
  placeholder,
  required = false,
  maxLength,
  onCommit,
  className = '',
}: {
  label: string
  value: string
  placeholder?: string
  /** 비우면 원래대로 (이름·내용) */
  required?: boolean
  maxLength?: number
  onCommit: (v: string) => void
  className?: string
}) {
  const { draft, setDraft, setEditing } = useDraft(value)
  const commit = () => {
    setEditing(false)
    const v = draft.trim()
    if (required && !v) return setDraft(value)
    if (v !== value) onCommit(v)
  }
  return (
    <input
      aria-label={label}
      value={draft}
      placeholder={placeholder}
      maxLength={maxLength}
      title={value || undefined}
      onFocus={() => setEditing(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setDraft(value)
          setEditing(false)
        }
      }}
      className={`${CELL_INPUT} truncate placeholder:text-cap/60 ${className}`}
    />
  )
}

/** 금액 칸 — 쉼표를 붙여 보여 주고, 0으로 비우면 원래대로 */
export function NumberCell({
  label,
  value,
  onCommit,
  prefix,
  max = 999_999_999,
  className = '',
}: {
  label: string
  value: number
  onCommit: (v: number) => void
  /** 앞에 붙는 표시 (예: 들어온 돈 '+') */
  prefix?: ReactNode
  max?: number
  className?: string
}) {
  const { draft, setDraft, setEditing } = useDraft(value)
  const commit = () => {
    setEditing(false)
    if (draft <= 0) return setDraft(value)
    if (draft !== value) onCommit(draft)
  }
  return (
    <span className="flex items-center" onClick={(e) => e.stopPropagation()}>
      {prefix && <span className="shrink-0">{prefix}</span>}
      <input
        aria-label={label}
        inputMode="numeric"
        value={draft ? draft.toLocaleString('ko-KR') : ''}
        placeholder="0"
        onFocus={() => setEditing(true)}
        onChange={(e) => setDraft(Math.min(Number(e.target.value.replace(/[^\d]/g, '')) || 0, max))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        className={`${CELL_INPUT} tnum text-right ${className}`}
      />
    </span>
  )
}

/** 날짜 칸 — '11/3'처럼 짧게 보이고, 누르면 달력이 열린다 */
export function DateCell({
  label,
  value,
  shown,
  max,
  onCommit,
  className = '',
}: {
  label: string
  /** YYYY-MM-DD */
  value: string
  /** 칸에 보이는 글 (예: '오늘', '11/3') */
  shown: ReactNode
  max?: string
  onCommit: (v: string) => void
  className?: string
}) {
  return (
    <span
      className={`relative flex h-9 items-center justify-center rounded-[4px] focus-within:bg-brand/5 focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {shown}
      <input
        type="date"
        aria-label={label}
        value={value}
        max={max}
        onChange={(e) => e.target.value && e.target.value !== value && onCommit(e.target.value)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.()
          } catch {
            /* 달력을 못 여는 브라우저 — 그냥 입력칸으로 */
          }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  )
}

export interface CellOption {
  value: string
  label: string
  /** 묶음 이름 (optgroup) */
  group?: string
}

/** 고르는 칸 — 고르면 바로 저장 */
export function SelectCell({
  label,
  value,
  options,
  onChange,
  className = '',
}: {
  label: string
  value: string
  options: CellOption[]
  onChange: (v: string) => void
  className?: string
}) {
  const groups = [...new Set(options.map((o) => o.group))]
  const opt = (o: CellOption) => (
    <option key={`${o.group ?? ''}:${o.value}`} value={o.value}>
      {o.label}
    </option>
  )
  return (
    <select
      aria-label={label}
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => e.target.value !== value && onChange(e.target.value)}
      className={`${CELL_INPUT} truncate ${className}`}
    >
      {groups.length === 1 && groups[0] === undefined
        ? options.map(opt)
        : groups.map((g) => (
            <optgroup key={g ?? ''} label={g ?? ''}>
              {options.filter((o) => o.group === g).map(opt)}
            </optgroup>
          ))}
    </select>
  )
}

/** 'YYYY-MM-DD' 날을 저장할 시각으로 — 그 날 낮 12시 (시간대가 밀려 하루 어긋나지 않게) */
export const noonOf = (day: string) => new Date(`${day}T12:00:00`).toISOString()
