import type { BudgetItem, CategoryGroup, Confession } from '../types'
import { NO_SPEND } from './constants'

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
    // 무지출(0원)은 기록일 뿐 지출이 아니므로 정산 합계에서 뺀다
    if (c.category === NO_SPEND || c.amount <= 0) continue
    const key = `${c.memberNo}:${c.kind}:${c.category}`
    m.set(key, (m.get(key) ?? 0) + c.amount)
  }
  return m
}

/**
 * (구성원:그룹:카테고리)별 고백 내역 — 합계가 뭘로 이뤄졌는지 펼쳐 보기 위한 것.
 *
 * 정산 화면엔 합계만 떠서, 숫자가 맞는지 보려면 가계부 탭으로 나갔다 와야 했다.
 * confessSums와 같은 키·같은 제외 규칙을 쓴다 — 둘이 어긋나면
 * "합계는 15만원인데 내역은 12만원"처럼 보인다.
 */
export function confessEntries(confessions: Confession[], ym: string): Map<string, Confession[]> {
  const m = new Map<string, Confession[]>()
  for (const c of monthConfessions(confessions, ym)) {
    if (c.category === NO_SPEND || c.amount <= 0) continue
    const key = `${c.memberNo}:${c.kind}:${c.category}`
    m.set(key, [...(m.get(key) ?? []), c])
  }
  // 최근 것부터 — 방금 적은 게 위에 온다
  for (const list of m.values()) list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
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
