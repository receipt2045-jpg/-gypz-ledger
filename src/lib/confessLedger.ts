import type { BudgetItem, CategoryGroup, Confession } from '../types'

// ── 고백 → 가계부 연결 ─────────────────────────
// 고백은 습관 로그지만, 쌓인 내역은 월간 가계부에서 보이고
// 정산 때 실제 금액의 초안이 되어야 한다.

/** ISO 시각을 사용자 로컬 기준 "YYYY-MM"으로 (자정 전후 고백이 엉뚱한 달로 가지 않게) */
export function ymOfIso(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 해당 월의 고백만 (최신순 유지) */
export function monthConfessions(confessions: Confession[], ym: string): Confession[] {
  return confessions.filter((c) => ymOfIso(c.createdAt) === ym)
}

/** (구성원:그룹:카테고리)별 고백 합계 — 정산 자동 반영용 */
export function confessSums(confessions: Confession[], ym: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of monthConfessions(confessions, ym)) {
    const key = `${c.memberNo}:${c.kind}:${c.category}`
    m.set(key, (m.get(key) ?? 0) + c.amount)
  }
  return m
}

export interface MissingConfessed {
  group: CategoryGroup
  category: string
  amount: number
}

/**
 * 고백은 했는데 정산 목록엔 아직 없는 항목.
 * 정산 화면에서 "빠뜨린 지출"을 그대로 보여주기 위한 계산 (금액 큰 순).
 */
export function missingConfessedItems(
  sums: Map<string, number> | null,
  member: 1 | 2,
  groups: CategoryGroup[],
  items: Pick<BudgetItem, 'member' | 'group' | 'category'>[],
): MissingConfessed[] {
  if (!sums) return []
  const out: MissingConfessed[] = []
  for (const [key, amount] of sums) {
    const [m, g, ...rest] = key.split(':')
    const category = rest.join(':') // 카테고리명에 ':'가 있어도 안전하게
    const group = g as CategoryGroup
    if (Number(m) !== member || !groups.includes(group)) continue
    const exists = items.some(
      (it) => it.member === member && it.group === group && it.category === category,
    )
    if (!exists) out.push({ group, category, amount })
  }
  return out.sort((a, b) => b.amount - a.amount)
}
