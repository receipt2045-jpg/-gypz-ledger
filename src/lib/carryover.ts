import type {
  AssetItem,
  AssetSnapshot,
  BudgetItem,
  CategoryGroup,
  MonthlyLedger,
} from '../types'
import { GROUP_ORDER } from './constants'
import { shiftYm } from './format'

/** 간단 uuid (crypto 지원 없을 때 fallback) */
export function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** 고정 성격 그룹: 값이 매달 이월되는 그룹 */
const FIXED_LIKE: CategoryGroup[] = ['income', 'saving', 'investment', 'fixed']
export function isFixedLike(group: CategoryGroup): boolean {
  return FIXED_LIKE.includes(group)
}

/**
 * 직전 월의 items로부터 새 달 items 파생 (이월 규칙 적용)
 *
 * ID에 인덱스를 붙이는 이유:
 * (그룹·카테고리·구성원)만으로 만들면 같은 카테고리를 두 개 쓰는 가구
 * (예: '부수입' 20만 + '부수입' 5만)에서 ID가 겹친다. 그러면 React key가
 * 충돌해 행이 엉뚱하게 보이고, 금액 수정·삭제가 두 행에 같이 먹는다.
 * 인덱스는 배열 순서가 유지되는 한 렌더마다 동일해서 입력 포커스도 안 튄다.
 */
export function deriveItemsFromPrevious(prevItems: BudgetItem[], ym: string): BudgetItem[] {
  return prevItems.map((it, i) => {
    const id = `${ym}-${it.group}-${it.category}-${it.member}-${i}`
    const base = it.actual || it.planned
    if (isFixedLike(it.group)) {
      // income/saving/investment/fixed: planned = actual = 지난달 값
      return { ...it, id, planned: base, actual: base }
    }
    // variable: planned = 지난달 planned, actual = 0
    return { ...it, id, planned: it.planned, actual: 0 }
  })
}

/**
 * 저장용 병합: 배우자 항목은 base(서버) 것을, 내 항목만 내 편집본을 쓴다.
 *
 * 정산 화면의 items는 진입 시점 스냅샷이라, 그사이 배우자가 다른 기기에서
 * 저장했으면 통째로 덮어쓰게 된다. 화면에서 편집 가능한 건 내 항목뿐이므로
 * 그 부분만 교체하는 게 안전하다.
 */
export function mergeMemberItems(
  baseItems: BudgetItem[],
  myItems: BudgetItem[],
  member: 1 | 2,
): BudgetItem[] {
  return [
    ...baseItems.filter((it) => it.member !== member),
    ...myItems.filter((it) => it.member === member),
  ]
}

/** ledgers 배열에서 ym 이하의 가장 최근 ledger 찾기 */
function findLatestBefore(ledgers: MonthlyLedger[], ym: string): MonthlyLedger | undefined {
  const before = ledgers.filter((l) => l.ym < ym).sort((a, b) => (a.ym < b.ym ? 1 : -1))
  return before[0]
}

/**
 * ym에 해당하는 ledger를 반환. 없으면 직전 월에서 파생(persist 안 함, 뷰 전용).
 * 아무 데이터도 없으면 빈 ledger.
 */
export function resolveLedger(ledgers: MonthlyLedger[], ym: string): MonthlyLedger {
  const existing = ledgers.find((l) => l.ym === ym)
  if (existing) return existing

  const prev = findLatestBefore(ledgers, ym)
  if (prev) {
    return { ym, items: deriveItemsFromPrevious(prev.items, ym), closed: false }
  }
  return { ym, items: [], closed: false }
}

/** 자산 스냅샷 파생: 직전 스냅샷 구조 복사(금액은 유지, 이후 갱신) */
export function deriveAssetsFromPrevious(prevItems: AssetItem[], ym: string): AssetItem[] {
  return prevItems.map((it) => ({
    ...it,
    id: `${ym}-${it.name}`,
  }))
}

/**
 * 자산 3-way 병합: 화면을 열어둔 사이 배우자가 추가한 자산을 지켜준다.
 *
 * 자산은 items처럼 구성원으로 나뉘지 않아(공동·자녀 계좌가 있다) 소유자로
 * 가를 수 없다. 대신 화면에 처음 불러온 목록(baseline)과 비교해서,
 * 서버에는 있는데 baseline엔 없는 항목 = 그사이 배우자가 추가한 것으로 보고 남긴다.
 *
 * @param server   저장 직전 서버에서 다시 읽은 목록
 * @param baseline 이 화면에 처음 불러왔던 목록
 * @param mine     지금 화면의 편집 결과
 */
export function mergeAssets(
  server: AssetItem[],
  baseline: AssetItem[],
  mine: AssetItem[],
): AssetItem[] {
  const baselineIds = new Set(baseline.map((it) => it.id))
  const mineById = new Map(mine.map((it) => [it.id, it]))
  const serverIds = new Set(server.map((it) => it.id))

  const out: AssetItem[] = []
  for (const s of server) {
    const edited = mineById.get(s.id)
    if (edited) out.push(edited) // 내가 고친 것 → 내 값
    else if (!baselineIds.has(s.id)) out.push(s) // 배우자가 새로 넣은 것 → 지킨다
    // baseline에 있었는데 내 목록엔 없다 = 내가 지운 것 → 버린다
  }
  for (const m of mine) {
    if (!serverIds.has(m.id)) out.push(m) // 내가 새로 넣은 것
  }
  return out
}

function findLatestSnapshotBefore(
  snapshots: AssetSnapshot[],
  ym: string,
): AssetSnapshot | undefined {
  const before = snapshots.filter((s) => s.ym <= ym).sort((a, b) => (a.ym < b.ym ? 1 : -1))
  return before[0]
}

export function resolveSnapshot(snapshots: AssetSnapshot[], ym: string): AssetSnapshot {
  const existing = snapshots.find((s) => s.ym === ym)
  if (existing) return existing

  const prev = findLatestSnapshotBefore(snapshots, ym)
  if (prev) {
    return { ym, items: deriveAssetsFromPrevious(prev.items, ym) }
  }
  return { ym, items: [] }
}

/** 결산 완료면 actual, 아니면 planned 를 유효값으로 사용 */
export function effectiveAmount(item: BudgetItem, closed: boolean): number {
  return closed ? item.actual : item.planned
}

/** 그룹별 유효 합계 */
export function sumGroup(ledger: MonthlyLedger, group: CategoryGroup): number {
  return ledger.items
    .filter((it) => it.group === group)
    .reduce((acc, it) => acc + effectiveAmount(it, ledger.closed), 0)
}

/** planned 합계 (그룹) */
export function sumGroupPlanned(ledger: MonthlyLedger, group: CategoryGroup): number {
  return ledger.items
    .filter((it) => it.group === group)
    .reduce((acc, it) => acc + it.planned, 0)
}

/** actual 합계 (그룹) */
export function sumGroupActual(ledger: MonthlyLedger, group: CategoryGroup): number {
  return ledger.items
    .filter((it) => it.group === group)
    .reduce((acc, it) => acc + it.actual, 0)
}

export interface LedgerSummary {
  income: number
  saving: number
  investment: number
  fixed: number
  variable: number
  expense: number // fixed + variable
  surplus: number // income - saving - investment - expense
  savingInvestRate: number // (saving + investment) / income
}

export function summarize(ledger: MonthlyLedger): LedgerSummary {
  const income = sumGroup(ledger, 'income')
  const saving = sumGroup(ledger, 'saving')
  const investment = sumGroup(ledger, 'investment')
  const fixed = sumGroup(ledger, 'fixed')
  const variable = sumGroup(ledger, 'variable')
  const expense = fixed + variable
  const surplus = income - saving - investment - expense
  const savingInvestRate = income > 0 ? (saving + investment) / income : 0
  return { income, saving, investment, fixed, variable, expense, surplus, savingInvestRate }
}

/** 순자산 = 자산 합 - 부채 합 */
export function netWorthOf(snapshot: AssetSnapshot): number {
  return snapshot.items.reduce(
    (acc, it) => acc + (it.kind === 'asset' ? it.amount : -it.amount),
    0,
  )
}

export function totalAssets(snapshot: AssetSnapshot): number {
  return snapshot.items
    .filter((it) => it.kind === 'asset')
    .reduce((acc, it) => acc + it.amount, 0)
}

export function totalDebts(snapshot: AssetSnapshot): number {
  return snapshot.items
    .filter((it) => it.kind === 'debt')
    .reduce((acc, it) => acc + it.amount, 0)
}

/** 최근 count개월 순자산 시계열 (ym 포함, 과거→현재 순) */
export function netWorthSeries(
  snapshots: AssetSnapshot[],
  endYm: string,
  count: number,
): { ym: string; value: number }[] {
  const out: { ym: string; value: number }[] = []
  for (let i = count - 1; i >= 0; i--) {
    const ym = shiftYm(endYm, -i)
    const snap = resolveSnapshot(snapshots, ym)
    out.push({ ym, value: netWorthOf(snap) })
  }
  return out
}

/** 존재하는 ledger들의 ym 정렬 목록 */
export function sortedYms(ledgers: MonthlyLedger[]): string[] {
  return ledgers.map((l) => l.ym).sort()
}

/** 활성 월: 가장 최근 ledger. 그게 closed면 다음 달. */
export function activeYm(ledgers: MonthlyLedger[]): string {
  if (ledgers.length === 0) {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  const latest = [...ledgers].sort((a, b) => (a.ym < b.ym ? 1 : -1))[0]
  return latest.closed ? shiftYm(latest.ym, 1) : latest.ym
}

/** 빈 BudgetItem 생성 */
export function emptyItem(group: CategoryGroup, category: string, member: 1 | 2): BudgetItem {
  return {
    id: genId(),
    group,
    category,
    member,
    planned: 0,
    actual: 0,
  }
}

/** 그룹 순서로 items 정렬 */
export function sortItemsByGroup(items: BudgetItem[]): BudgetItem[] {
  return [...items].sort((a, b) => {
    const ga = GROUP_ORDER.indexOf(a.group)
    const gb = GROUP_ORDER.indexOf(b.group)
    if (ga !== gb) return ga - gb
    return a.member - b.member
  })
}
