/**
 * 금액 칸 계산기 (2026-10-07 제보: "금액 쓸 때 계산기 기능이 있으면 좋겠어요").
 * "38,000 + 12,500 × 2" 같은 식을 계산한다. eval은 쓰지 않는다 — 숫자와 + − × ÷ 괄호만.
 */

/** 화면에 보이는 기호(× ÷ −)와 키보드 기호(* / -)를 같은 것으로 */
export function normalizeExpr(raw: string): string {
  return raw
    .replace(/[×xX]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/[,\s원]/g, '')
}

/** 연산 기호가 들어 있으면 계산식 — 맨 앞 '-'(음수)만 있는 건 식이 아니다 */
export function isExpr(raw: string): boolean {
  return /[+*/]|.-/.test(normalizeExpr(raw))
}

/** 계산 결과(원 단위 반올림). 식이 덜 끝났거나 잘못됐으면 null */
export function evaluate(raw: string): number | null {
  const s = normalizeExpr(raw)
  if (!s || !/^[\d+\-*/().]+$/.test(s)) return null
  let i = 0
  const peek = () => s[i]
  const num = (): number | null => {
    if (peek() === '(') {
      i++
      const v = expr()
      if (v === null || peek() !== ')') return null
      i++
      return v
    }
    if (peek() === '-') {
      i++
      const v = num()
      return v === null ? null : -v
    }
    const m = /^\d+(\.\d+)?/.exec(s.slice(i))
    if (!m) return null
    i += m[0].length
    return Number(m[0])
  }
  const term = (): number | null => {
    let v = num()
    while (v !== null && (peek() === '*' || peek() === '/')) {
      const op = s[i++]
      const r = num()
      if (r === null) return null
      if (op === '/' && r === 0) return null
      v = op === '*' ? v * r : v / r
    }
    return v
  }
  const expr = (): number | null => {
    let v = term()
    while (v !== null && (peek() === '+' || peek() === '-')) {
      const op = s[i++]
      const r = term()
      if (r === null) return null
      v = op === '+' ? v + r : v - r
    }
    return v
  }
  const v = expr()
  if (v === null || i !== s.length || !Number.isFinite(v)) return null
  return Math.round(v)
}
