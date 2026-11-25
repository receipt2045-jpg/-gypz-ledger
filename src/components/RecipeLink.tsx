import { useNavigate } from 'react-router-dom'
import { ChefHat, ChevronRight } from 'lucide-react'

/**
 * 집밥 플래너(/recipes)로 가는 입구 (2026-11-26 결영 요청: "원래 가계부에서 바로 가기").
 * - card: 가계부 탭 '오늘의 소비 기록' 아래
 * - nudge: 오늘의 소비 기록 저장 뒤 — 식비를 적었을 때만
 */
export default function RecipeLink({ variant = 'card' }: { variant?: 'card' | 'nudge' }) {
  const navigate = useNavigate()
  if (variant === 'nudge')
    return (
      <button
        onClick={() => navigate('/recipes')}
        className="flex w-full items-center justify-between gap-2 rounded-card bg-emerald-50 px-4 py-3 text-left active:bg-emerald-100"
      >
        <span className="flex items-center gap-2 text-[14px] font-bold text-emerald-700">
          <ChefHat size={17} className="shrink-0" /> 이번 주 집밥으로 식비 아끼기
        </span>
        <ChevronRight size={18} className="shrink-0 text-emerald-500" />
      </button>
    )
  return (
    <button
      onClick={() => navigate('/recipes')}
      className="flex w-full items-center gap-3 rounded-card bg-white px-4 py-3.5 text-left shadow-card active:bg-line"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
        <ChefHat size={20} className="text-emerald-600" />
      </span>
      <span className="flex-1">
        <span className="block text-[14.5px] font-bold text-ink">집밥 플래너</span>
        <span className="mt-0.5 block text-[12.5px] text-sub">
          이번 주 한 상과 장보기를 짜 줘요
        </span>
      </span>
      <span className="flex shrink-0 items-center text-[13px] font-bold text-emerald-600">
        보러 가기 <ChevronRight size={15} />
      </span>
    </button>
  )
}

/** 방금 적은 기록에 먹는 데 쓴 돈이 있는지 — 있으면 저장 뒤 집밥 플래너를 권한다 */
export const isFoodSpend = (category: string) =>
  /식비|식자재|장보기|마트|배달|외식|간식|카페|반찬|먹/.test(category)
