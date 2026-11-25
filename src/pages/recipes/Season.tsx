import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SEASON, SEASON_KIND_NAME, recipesUsing, type SeasonItem } from '../../lib/season'
import { Dish, KidTag, RoleTag, Tabs } from './ui'

/** /recipes/season — 제철 재료 달력 */
export function Season({ month: now }: { month: number }) {
  const navigate = useNavigate()
  const [month, setMonth] = useState(now)
  const [pick, setPick] = useState<string | null>(null)
  const items = SEASON[month] ?? []
  const picked = items.find((i) => i.ing === pick)
  const shift = (n: number) => {
    setMonth(((month - 1 + n + 12) % 12) + 1)
    setPick(null)
  }
  const kinds = ['sea', 'veg', 'fruit'] as const

  return (
    <>
      <Tabs at="season" />
      <div className="px-4 pb-6 pt-6">
        <div className="flex items-center justify-between">
          <button onClick={() => shift(-1)} aria-label="앞 달" className="flex h-10 w-10 items-center justify-center rounded-full bg-bg">
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-[24px] font-extrabold text-ink">
            {month}월 제철{month === now && <span className="ml-1.5 text-[13px] font-bold text-brand">이번 달</span>}
          </h1>
          <button onClick={() => shift(1)} aria-label="다음 달" className="flex h-10 w-10 items-center justify-center rounded-full bg-bg">
            <ChevronRight size={20} />
          </button>
        </div>

        {kinds.map((k) => {
          const list = items.filter((i) => i.kind === k)
          if (!list.length) return null
          return (
            <section key={k} className="mt-6">
              <p className="mb-2 text-[14px] font-bold text-sub">{SEASON_KIND_NAME[k]}</p>
              <div className="flex flex-wrap gap-2">
                {list.map((i) => (
                  <ItemChip key={i.name} i={i} on={pick !== null && i.ing === pick} onPick={setPick} />
                ))}
              </div>
            </section>
          )
        })}
        <p className="mt-3 text-[12px] text-cap">밑줄 친 재료는 눌러서 레시피를 볼 수 있어요.</p>

        {picked?.ing && (
          <section className="mt-6">
            <p className="text-[17px] font-extrabold text-ink">{picked.name} 넣은 레시피</p>
            <ul className="mt-3 space-y-3">
              {recipesUsing(picked.ing).map((r) => (
                <li key={r.slug}>
                  <button
                    onClick={() => {
                      navigate(`/recipes/${r.slug}`)
                      window.scrollTo(0, 0)
                    }}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <Dish r={r} className="h-14 w-14 shrink-0 rounded-xl" />
                    <span className="min-w-0 flex-1">
                      <span className="flex gap-1">
                        <RoleTag role={r.role} />
                        <KidTag r={r} />
                      </span>
                      <span className="mt-0.5 block truncate text-[16px] font-bold text-ink">{r.name}</span>
                    </span>
                    <ChevronRight size={16} className="text-cap" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="mt-6 text-[12px] leading-relaxed text-cap">
          흔히 그 달에 많이 나고 값이 내려가는 재료예요. 지역·날씨에 따라 조금씩 달라요. 식단을 짤 때 이번 달 제철
          재료가 들어간 반찬을 먼저 골라요.
        </p>
      </div>
    </>
  )
}

function ItemChip({ i, on, onPick }: { i: SeasonItem; on: boolean; onPick: (id: string | null) => void }) {
  const tint = i.kind === 'sea' ? 'bg-blue-50 text-blue-800' : i.kind === 'veg' ? 'bg-green-50 text-green-800' : 'bg-orange-50 text-orange-800'
  if (!i.ing) return <span className={`rounded-full px-3.5 py-1.5 text-[15px] font-bold ${tint}`}>{i.name}</span>
  return (
    <button
      onClick={() => onPick(on ? null : i.ing!)}
      aria-pressed={on}
      className={`rounded-full px-3.5 py-1.5 text-[15px] font-bold underline underline-offset-4 ${
        on ? 'bg-ink text-white' : tint
      }`}
    >
      {i.name}
    </button>
  )
}
