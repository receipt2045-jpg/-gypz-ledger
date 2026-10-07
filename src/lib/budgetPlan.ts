import type { BudgetItem, CategoryGroup, Contributions } from '../types'

/**
 * 예산 표 (2026-10-07) — 남편 · 공동 · 아내 세 칸에 월급부터 생활비까지 빼 나가서
 * 맨 아래 '남는 돈'을 0으로 맞춘다. 공동 칸 = 공동통장 (각자 보내는 돈으로 채워지고 거기서 나간다).
 */
export type Col = 1 | 2 | 'j'
export type RowKey = 'income' | 'save' | 'fixed' | 'variable'

export const COLS: Col[] = [1, 'j', 2]

/** 순서는 사용자 요청대로 — 월급 → 저축·투자 → 고정비 → 생활비 (공동통장 줄은 월급 바로 아래) */
export const ROWS: { key: RowKey; label: string; groups: CategoryGroup[] }[] = [
  { key: 'income', label: '월급', groups: ['income'] },
  { key: 'save', label: '저축·투자', groups: ['saving', 'investment'] },
  { key: 'fixed', label: '고정비', groups: ['fixed'] },
  { key: 'variable', label: '생활비', groups: ['variable'] },
]

export const NO_CONTRIBUTIONS: Contributions = { 1: 0, 2: 0 }

export function colOf(it: BudgetItem): Col {
  return it.shared ? 'j' : it.member
}

export function rowOf(row: RowKey) {
  return ROWS.find((r) => r.key === row)!
}

export function cellItems(items: BudgetItem[], row: RowKey, col: Col): BudgetItem[] {
  const groups = rowOf(row).groups
  return items.filter((it) => groups.includes(it.group) && colOf(it) === col)
}

export function cellSum(items: BudgetItem[], row: RowKey, col: Col): number {
  return cellItems(items, row, col).reduce((a, it) => a + it.planned, 0)
}

/** 칸마다 남는 돈 — 사람: 월급 − 공동통장으로 − 저축 − 고정 − 생활 / 공동: 모인 돈 − 공동에서 나가는 돈 */
export function leftOf(items: BudgetItem[], con: Contributions, col: Col): number {
  const out = (['save', 'fixed', 'variable'] as RowKey[]).reduce(
    (a, r) => a + cellSum(items, r, col),
    0,
  )
  if (col === 'j') return con[1] + con[2] + cellSum(items, 'income', 'j') - out
  return cellSum(items, 'income', col) - con[col] - out
}

export function totalLeft(items: BudgetItem[], con: Contributions): number {
  return COLS.reduce((a, c) => a + leftOf(items, con, c), 0)
}

export function totalIncome(items: BudgetItem[]): number {
  return COLS.reduce((a, c) => a + cellSum(items, 'income', c), 0)
}

/** 공동통장에서 나갈 돈 — '나갈 돈 반반'·'소득 비율로'의 기준 */
export function sharedNeed(items: BudgetItem[]): number {
  return (['save', 'fixed', 'variable'] as RowKey[]).reduce((a, r) => a + cellSum(items, r, 'j'), 0)
}

/** 공동통장에서 나갈 돈을 반반으로, 또는 월급 비율로 나눈다 (만원 단위로 반올림) */
export function splitContributions(items: BudgetItem[], mode: 'half' | 'income'): Contributions {
  const need = sharedNeed(items)
  const i1 = cellSum(items, 'income', 1)
  const i2 = cellSum(items, 'income', 2)
  const ratio = mode === 'half' || i1 + i2 === 0 ? 0.5 : i1 / (i1 + i2)
  const one = Math.round((need * ratio) / 10_000) * 10_000
  return { 1: one, 2: Math.max(0, need - one) }
}

/**
 * 저장할 때 합치기 — 이 화면을 연 사이 배우자가 바꾼 것을 지킨다.
 * 내가 안 건드린 항목은 서버 것을, 배우자가 새로 넣은 항목은 그대로 남기고,
 * 배우자가 지운 항목(내가 안 건드렸으면)은 지운다.
 */
export function mergeBudget(
  server: BudgetItem[],
  baseline: BudgetItem[],
  mine: BudgetItem[],
): BudgetItem[] {
  const base = new Map(baseline.map((it) => [it.id, it]))
  const srv = new Map(server.map((it) => [it.id, it]))
  const same = (a: BudgetItem, b: BudgetItem) => JSON.stringify(a) === JSON.stringify(b)
  const out: BudgetItem[] = []
  for (const it of mine) {
    const b = base.get(it.id)
    const untouched = b !== undefined && same(b, it)
    if (untouched && !srv.has(it.id)) continue // 배우자가 지움
    out.push(untouched ? srv.get(it.id)! : it)
  }
  const known = new Set([...base.keys(), ...mine.map((it) => it.id)])
  return [...out, ...server.filter((it) => !known.has(it.id))]
}
