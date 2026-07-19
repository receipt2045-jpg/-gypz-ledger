import { PiggyBank } from 'lucide-react'
import { weeklyReduceCost } from '../lib/reactions'
import { abbreviateKRW, formatWon } from '../lib/format'
import type { Confession } from '../types'

/**
 * 면죄부 방지 — 이번 주 '줄일 수 있었던' 지출을 적금 기회비용으로 환산.
 * (원팀가계부 P1 6) reduce 고백이 있을 때만 노출.
 */
export default function WeeklyCostCard({ confessions }: { confessions: Confession[] }) {
  const { count, weekSum, perYear, tenYears } = weeklyReduceCost(confessions)
  if (count === 0 || weekSum === 0) return null

  return (
    <div className="rounded-card bg-ink px-5 py-4 text-white shadow-card">
      <div className="mb-1 flex items-center gap-1.5">
        <PiggyBank size={16} className="text-white/70" />
        <p className="text-[13px] font-semibold text-white/70">이번 주 줄일 수 있었던 돈 👀</p>
      </div>
      <p className="tnum text-[26px] font-extrabold">{formatWon(weekSum)}</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-white/80">
        고백 {count}번 모아보니 이만큼이에요. 매주 이 돈을 적금하면{' '}
        <b className="text-white">1년에 {abbreviateKRW(perYear)}</b>,{' '}
        <b className="text-white">10년이면 {abbreviateKRW(tenYears)}</b> 🤍
      </p>
    </div>
  )
}
