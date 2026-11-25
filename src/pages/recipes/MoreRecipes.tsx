import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { RECIPES, type Recipe } from '../../lib/recipes'
import { KidTag, RoleTag } from './ui'

/**
 * 레시피 페이지 끝 — 다른 자료 대신 레시피끼리만 이어지게 (2026-11-26 결영).
 * 보고 있는 레시피가 있으면 같은 자리(메인·서브·국) 중 같은 고기·제철 먼저, 없으면 이번 달 제철 레시피.
 * 사진이 아직 없는 레시피가 많아 그림 없이 한 줄씩.
 */
export function MoreRecipes({ recipe, month }: { recipe?: Recipe; month: number }) {
  const navigate = useNavigate()
  const score = (r: Recipe) =>
    (recipe && r.role === recipe.role ? 4 : 0) +
    (recipe?.protein && r.protein === recipe.protein ? 2 : 0) +
    (r.months?.includes(month) ? 1.5 : 0) +
    (r.kid !== 'adult' ? 1 : 0) +
    // 같은 점수끼리는 이름 순서가 아니라 고르게 섞이게
    (r.slug.length % 7) / 10
  const list = RECIPES.filter((r) => r.slug !== recipe?.slug)
    .sort((a, b) => score(b) - score(a))
    .slice(0, 6)
  const go = (to: string) => {
    navigate(to)
    window.scrollTo(0, 0)
  }
  return (
    <section className="rounded-2xl bg-white px-4 py-5">
      <h2 className="text-[19px] font-extrabold text-ink">{recipe ? '이런 레시피도 있어요' : `${month}월에 해 먹기 좋은 레시피`}</h2>
      <ul className="mt-2">
        {list.map((r) => (
          <li key={r.slug} className="border-b border-line last:border-0">
            <button onClick={() => go(`/recipes/${r.slug}`)} className="flex w-full items-center gap-2 py-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  <RoleTag role={r.role} />
                  <KidTag r={r} />
                </span>
                <span className="mt-1 block truncate text-[16px] font-bold text-ink">{r.name}</span>
                <span className="block truncate text-[13px] text-cap">
                  {r.sub} · {r.minutes}분
                </span>
              </span>
              <ChevronRight size={16} className="shrink-0 text-cap" />
            </button>
          </li>
        ))}
      </ul>
      <button
        onClick={() => go('/recipes/all')}
        className="mt-3 w-full rounded-btn border border-line py-3 text-[14px] font-bold text-sub"
      >
        레시피 {RECIPES.length}가지 전체 보기
      </button>
    </section>
  )
}
