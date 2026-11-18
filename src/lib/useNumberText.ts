import { useState } from 'react'

/**
 * 숫자 칸에 지금 쳐 둔 글자를 따로 들고 있는다 (2026-11-19 점검).
 *
 * 숫자만 들고 다시 그리면 "4."을 치는 순간 점이 사라져 4.5가 45가 되고,
 * 0.3은 "0."에서 0으로 돌아가 칠 수 없고, 칸을 비우면 0이 다시 나타났다.
 * 바깥에서 값이 바뀌면(초기화·가계부 숫자 채우기) 그 값으로 다시 맞춘다.
 *
 * 빈 칸은 0으로 넘긴다 — 빈 칸이 '기본값'인 칸(복비 요율 등)이 그 뜻을 그대로 쓴다.
 */
export function useNumberText(
  value: number,
  onChange: (n: number) => void,
  { decimal = true, blankZero = false }: { decimal?: boolean; blankZero?: boolean } = {},
) {
  const fmt = (v: number) => (!Number.isFinite(v) || (blankZero && v === 0) ? '' : String(v))
  const [text, setText] = useState(() => fmt(value))
  const [seen, setSeen] = useState(value)
  if (value !== seen) {
    setSeen(value)
    setText(fmt(value))
  }
  const change = (raw: string) => {
    let t = raw.replace(decimal ? /[^\d.]/g : /\D/g, '')
    // 점은 하나만
    const dot = t.indexOf('.')
    if (dot !== -1) t = t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\./g, '')
    const n = t === '' || t === '.' ? 0 : Number(t)
    setText(t)
    setSeen(n)
    onChange(n)
  }
  return { text, change }
}
