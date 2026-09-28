import { abbreviateKRW } from '../lib/format'
import type { BudgetItem } from '../types'

interface CatBudget {
  category: string
  planned: number
  actual: number
}

/**
 * 카테고리별 예산 대비 지출 막대 (호호양·구채희 홈의 대표 만족 요소).
 * 예산(계획) 대비 실제 사용률을 가로 막대로. 초과는 빨강.
 */
export default function BudgetBars({
  items,
  confessed,
  settledMembers = [],
  closed = false,
}: {
  items: BudgetItem[]
  /** (구성원:그룹:카테고리) → 이번 달 소비 기록 합계. 정산 전인 사람 몫을 채우는 데 쓴다 */
  confessed?: Map<string, number> | null
  settledMembers?: (1 | 2)[]
  closed?: boolean
}) {
  /**
   * 제보(9/10): "지출에서 각 카테고리별로 현재 얼마나 사용했는지 알 수 있었으면".
   * 정산 전엔 실제값이 0이라 막대가 늘 비어 있었다. 아직 정산 안 한 사람 몫은
   * 이번 달 소비 기록 합계로 채운다. 정산한 사람 몫은 정산 금액이 맞는 값이라 그대로 둔다.
   */
  const settled = new Set(settledMembers)
  const useLog = (member: 1 | 2) => !!confessed && !closed && !settled.has(member)
  const applied = new Set<string>() // 같은 키 항목이 둘이면 기록 합계는 한 번만 얹는다
  let fromLog = false

  // 지출(고정+변동) 카테고리별로 계획·실제 합산
  const map = new Map<string, CatBudget>()
  const add = (category: string, planned: number, actual: number) => {
    const cur = map.get(category) ?? { category, planned: 0, actual: 0 }
    cur.planned += planned
    cur.actual += actual
    map.set(category, cur)
  }
  for (const it of items) {
    if (it.group !== 'fixed' && it.group !== 'variable') continue
    let actual = it.actual
    const key = `${it.member}:${it.group}:${it.category}`
    if (useLog(it.member) && !applied.has(key)) {
      const logged = confessed!.get(key) ?? 0
      if (logged > actual) {
        actual = logged
        fromLog = true
      }
      applied.add(key)
    }
    add(it.category, it.planned, actual)
  }
  // 목록엔 없는데 기록만 있는 지출도 보여준다 (예산 없이 쓴 돈)
  if (confessed) {
    for (const [key, amount] of confessed) {
      if (applied.has(key) || amount <= 0) continue
      const [m, group, ...rest] = key.split(':')
      const member = Number(m) as 1 | 2
      if ((group !== 'fixed' && group !== 'variable') || !useLog(member)) continue
      add(rest.join(':'), 0, amount)
      fromLog = true
    }
  }
  // 예산이 있거나, 예산은 없어도 쓴 게 있는 카테고리.
  // 제보(2026-09-11): "예산 대비 지출도 남편 것만 적용된 것 같아요".
  // 정산 중에 넣은 항목은 planned=0이라 예전엔 여기서 통째로 빠졌다 — 쓴 돈이 화면에서 사라졌다.
  // 예산 있는 것은 예산 큰 순, 예산 없는 것은 그 뒤에 쓴 돈 큰 순.
  const cats = [...map.values()]
    .filter((c) => c.planned > 0 || c.actual > 0)
    .sort((a, b) => {
      if (a.planned > 0 !== b.planned > 0) return a.planned > 0 ? -1 : 1
      return a.planned > 0 ? b.planned - a.planned : b.actual - a.actual
    })

  const totalPlanned = cats.reduce((s, c) => s + c.planned, 0)
  const totalActual = cats.reduce((s, c) => s + c.actual, 0)

  if (cats.length === 0) {
    return (
      <p className="py-2 text-[13px] leading-relaxed text-sub">
        '예산 세우기'로 이번 달 지출 예산을 정하면,
        <br />
        여기서 예산 대비 얼마 썼는지 한눈에 볼 수 있어요.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {/* 전체 사용률 */}
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-sub">
          지출 <span className="tnum font-bold text-ink">{abbreviateKRW(totalActual)}</span>
          <span className="text-cap"> / 예산 {abbreviateKRW(totalPlanned)}</span>
        </span>
        <span
          className={`tnum text-[13px] font-bold ${totalActual > totalPlanned ? 'text-danger' : 'text-brand'}`}
        >
          {totalPlanned > 0 ? `${Math.round((totalActual / totalPlanned) * 100)}%` : '예산 없음'}
        </span>
      </div>

      {fromLog && (
        <p className="-mt-1 text-[11.5px] text-cap">정산 전인 분은 이번 달 소비 기록으로 채웠어요</p>
      )}

      {/* 카테고리별 막대 */}
      <div className="space-y-2.5">
        {cats.map((c) => {
          // 예산 없이 쓴 것은 '초과'가 아니라 '예산이 없는 것'이다 — 빨강 대신 회색 꽉 찬 막대
          const unbudgeted = c.planned === 0
          const ratio = c.planned > 0 ? c.actual / c.planned : 1
          const over = !unbudgeted && c.actual > c.planned
          const width = Math.min(ratio, 1) * 100
          return (
            <div key={c.category}>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span className="font-medium text-ink">{c.category}</span>
                <span className={`tnum ${over ? 'font-bold text-danger' : 'text-sub'}`}>
                  {abbreviateKRW(c.actual)}
                  <span className="text-cap"> / {unbudgeted ? '예산 없음' : abbreviateKRW(c.planned)}</span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full rounded-full ${over ? 'bg-danger' : unbudgeted ? 'bg-cap/50' : 'bg-brand'}`}
                  style={{ width: `${over ? 100 : width}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
