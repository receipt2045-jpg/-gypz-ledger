import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { ReelEpisode } from '../../lib/reels'
import { portionsOf, tripShopping } from '../../lib/mealPlan'
import { INGREDIENTS, amountText, ingredientsFor, recipeBySlug, type Recipe } from '../../lib/recipes'
import { Dish, Part, RoleTag, Tabs, wonShort } from './ui'
import type { Planner } from './usePlanner'

/** /recipes/reel-1123 — 릴스 편 한 상 (댓글 나눔 링크) */
export function Reel({ ep, p }: { ep: ReelEpisode; p: Planner }) {
  const navigate = useNavigate()
  const [baby, setBaby] = useState(false)
  const dishes = [ep.meal.main, ep.meal.sub, ep.meal.soup].map(recipeBySlug).filter((r): r is Recipe => !!r)
  const s = p.settings
  const cost = tripShopping([ep.meal], s, p.packs).total

  return (
    <>
      <Tabs at="week" />
      <div className="px-4 pb-6 pt-6">
        <span className="rounded-md bg-bg px-2 py-0.5 text-[12px] font-bold text-sub">
          {Number(ep.date.slice(5, 7))}/{Number(ep.date.slice(8))} 릴스 {ep.no}편
        </span>
        <h1 className="mt-2 text-[23px] font-extrabold leading-snug text-ink">{ep.title}</h1>
        <p className="mt-1 text-[14px] text-sub">{ep.note}</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {dishes.map((r) => (
            <div key={r.slug}>
              <Dish r={r} className="aspect-square w-full rounded-xl" />
              <span className="mt-1 block">
                <RoleTag role={r.role} />
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[14px] text-sub">
          {s.adults + s.kids}식구({portionsOf(s)}인분) 한 끼 재료 {cost !== null ? `약 ${wonShort(cost)}` : ''}
          {ep.spent ? ` · 영상 속 장보기 ${wonShort(ep.spent)}` : ''}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-btn bg-bg p-1" role="group" aria-label="보기">
          <button
            onClick={() => setBaby(false)}
            aria-pressed={!baby}
            className={`rounded-[10px] py-2.5 text-[14px] font-bold ${!baby ? 'bg-white text-ink shadow-sm' : 'text-sub'}`}
          >
            어른 상
          </button>
          <button
            onClick={() => setBaby(true)}
            aria-pressed={baby}
            className={`rounded-[10px] py-2.5 text-[14px] font-bold ${baby ? 'bg-white text-ink shadow-sm' : 'text-sub'}`}
          >
            아기 식판
          </button>
        </div>

        {baby ? (
          <div className="mt-4 rounded-2xl bg-pink-50 px-4 py-4 text-pink-900">
            <p className="text-[16px] font-extrabold">아기 몫 덜어내기</p>
            <ul className="mt-2 space-y-2 text-[15px] leading-relaxed">
              {dishes.map((r) => (
                <li key={r.slug}>
                  <b>{r.name}</b> — {r.babyTip ?? '어른 것과 같이 작게 잘라 주세요.'}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[12px] text-pink-800/80">
              3살 아이는 어른보다 싱겁게 — 간장·소금 넣기 전에 덜어 두면 따로 만들 필요가 없어요.
            </p>
          </div>
        ) : null}

        {dishes.map((r) => (
          <Part key={r.slug} title={r.name} right={`${r.minutes}분`}>
            <ul className="text-[15px]">
              {ingredientsFor(r, portionsOf(s))
                .filter(([id]) => id !== 'rice')
                .map(([id, a]) => (
                  <li key={id} className="flex justify-between border-b border-line py-2">
                    <span className="text-ink">{INGREDIENTS[id]?.name}</span>
                    <span className="text-sub">{amountText(id, a)}</span>
                  </li>
                ))}
            </ul>
            <ol className="mt-3 space-y-2.5">
              {r.steps.map((st, i) => (
                <li key={st} className="flex gap-3">
                  <span className="text-[17px] font-extrabold leading-none text-brand">{i + 1}</span>
                  <p className="text-[15px] leading-relaxed text-ink">{st}</p>
                </li>
              ))}
            </ol>
            <button
              onClick={() => {
                navigate(`/recipes/${r.slug}`)
                window.scrollTo(0, 0)
              }}
              className="mt-3 flex items-center gap-0.5 text-[13px] font-bold text-sub"
            >
              자세히 보기 <ChevronRight size={14} />
            </button>
          </Part>
        ))}

        <button
          onClick={() => {
            navigate('/recipes')
            window.scrollTo(0, 0)
          }}
          className="mt-8 w-full rounded-btn bg-ink py-4 text-[15px] font-bold text-white"
        >
          우리집 이번 주 집밥 짜 보기
        </button>
      </div>
    </>
  )
}
