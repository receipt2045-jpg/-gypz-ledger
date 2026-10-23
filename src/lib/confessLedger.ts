import { ymOfDate } from './format'
import type { BudgetItem, CategoryGroup, Confession } from '../types'
import { NO_SPEND } from './constants'

// ── 고백 → 가계부 연결 ─────────────────────────
// 고백은 습관 로그지만, 쌓인 내역은 월간 가계부에서 보이고
// 정산 때 실제 금액의 초안이 되어야 한다.

/** ISO 시각을 사용자 로컬 기준 가계부 달 "YYYY-MM"으로 (자정 전후·한 달 시작일 반영) */
export function ymOfIso(iso: string): string {
  return ymOfDate(new Date(iso))
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

export type SpendWho = 1 | 2 | 'shared'

export interface MonthSpend {
  /** 이번 달 쓴 돈 전부 (수입·무지출 빼고) */
  spent: number
  count: number
  /** 생활비·용돈 예산 — 예산 표의 생활비 칸 + 고정비의 '용돈' */
  budget: number
  /** 그 예산에서 나간 돈 (생활비 기록 + '용돈' 기록) */
  budgetSpent: number
}

/** 생활비·용돈 — 매일 쓰면서 줄여 갈 수 있는 돈 */
const isLiving = (group: CategoryGroup, category: string) =>
  group === 'variable' || (group === 'fixed' && category === '용돈')

/**
 * 한 사람(또는 공동)의 이번 달 지출 합계와 남은 생활비·용돈.
 * 제보(10/23): "내가 쓴 기록 총 금액을 볼 수 있나요? 남은 생활비나 용돈 보면서 소비 조절하고 싶어요".
 * 사람별 보기는 공동 기록을 뺀다 — 월간 탭의 사람별 보기와 같은 규칙.
 */
export function monthSpend(
  confessions: Confession[],
  items: Pick<BudgetItem, 'member' | 'group' | 'category' | 'planned' | 'shared'>[],
  ym: string,
  who: SpendWho,
): MonthSpend {
  const mine = (shared: boolean | undefined, member: 1 | 2) =>
    who === 'shared' ? !!shared : !shared && member === who
  const list = monthConfessions(confessions, ym).filter(
    (c) =>
      c.kind !== 'income' && c.category !== NO_SPEND && c.amount > 0 && mine(c.shared, c.memberNo),
  )
  return {
    spent: list.reduce((s, c) => s + c.amount, 0),
    count: list.length,
    budget: items
      .filter((it) => isLiving(it.group, it.category) && mine(it.shared, it.member))
      .reduce((s, it) => s + it.planned, 0),
    budgetSpent: list.filter((c) => isLiving(c.kind, c.category)).reduce((s, c) => s + c.amount, 0),
  }
}
