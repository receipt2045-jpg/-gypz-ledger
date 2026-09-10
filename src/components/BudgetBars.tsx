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
export default function BudgetBars({ items }: { items: BudgetItem[] }) {
  // 지출(고정+변동) 카테고리별로 계획·실제 합산
  const map = new Map<string, CatBudget>()
  for (const it of items) {
    if (it.group !== 'fixed' && it.group !== 'variable') continue
    const cur = map.get(it.category) ?? { category: it.category, planned: 0, actual: 0 }
    cur.planned += it.planned
    cur.actual += it.actual
    map.set(it.category, cur)
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
