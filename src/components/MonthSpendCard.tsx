import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useLedgerStore } from '../lib/store'
import { resolveLedger } from '../lib/carryover'
import { monthSpend, type SpendWho } from '../lib/confessLedger'
import { abbreviateKRW, currentYm, daysLeftInYm, formatWon } from '../lib/format'

/**
 * 이번 달 쓴 돈 · 남은 생활비·용돈 — 기록하는 화면에서 바로 본다.
 * 제보(10/23): "내가 사용한 기록들 총 금액을 볼 수 있는 기능은 없나요?
 * 남은 생활비나 용돈 보면서 소비 조절하고 싶어요". 합계는 월간 탭 깊숙이에만 있었다.
 */
/** initial: 처음 보여줄 사람 — 기록 직후엔 방금 적은 사람(공동 포함) */
export default function MonthSpendCard({ initial }: { initial?: SpendWho }) {
  const navigate = useNavigate()
  const { confessions, ledgers, memberNo, profile } = useLedgerStore()
  const me: 1 | 2 = memberNo ?? 1
  const [who, setWho] = useState<SpendWho>(initial ?? me)

  const ym = currentYm()
  const items = resolveLedger(ledgers, ym).items
  const { spent, count, budget, budgetSpent } = monthSpend(confessions, items, ym, who)
  const left = budget - budgetSpent
  const days = daysLeftInYm(ym)
  const names: [string, string] = [profile.member1Name, profile.member2Name]
  const label = (w: SpendWho) => (w === 'shared' ? '공동' : names[w - 1])

  return (
    <div className="rounded-card bg-card px-4 py-3.5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <span className="shrink-0 text-[13px] font-bold text-sub">이번 달 쓴 돈</span>
        <div className="flex min-w-0 gap-1">
          {([1, 2, 'shared'] as const).map((w) => (
            <button
              key={w}
              onClick={() => setWho(w)}
              aria-pressed={who === w}
              className={`min-w-0 truncate rounded-full px-2.5 py-1 text-[12px] font-bold transition-colors ${
                who === w ? 'bg-ink text-white' : 'bg-bg text-sub active:bg-line'
              }`}
            >
              {label(w)}
              {w === me && label(w).length <= 3 && ' (나)'}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className="tnum text-[24px] font-extrabold text-ink">{formatWon(spent)}</span>
        <span className="text-[12.5px] text-cap">{count}건</span>
      </p>

      {budget > 0 ? (
        <>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
            <div
              className={`h-full rounded-full transition-all ${left < 0 ? 'bg-danger' : 'bg-brand'}`}
              style={{ width: `${Math.min(100, Math.round((budgetSpent / budget) * 100))}%` }}
            />
          </div>
          <p className="mt-1.5 text-[13px] font-bold text-ink">
            {left >= 0 ? (
              <>
                생활비·용돈 {abbreviateKRW(budget)} 중{' '}
                <span className="text-brand">{formatWon(left)} 남았어요</span>
              </>
            ) : (
              <>
                생활비·용돈 {abbreviateKRW(budget)}보다{' '}
                <span className="text-danger">{formatWon(-left)} 넘었어요</span>
              </>
            )}
          </p>
          {left > 0 && days > 0 && (
            <p className="mt-0.5 text-[12px] text-sub">
              남은 {days}일, 하루 {formatWon(Math.floor(left / days / 100) * 100)}씩 쓰면 돼요
            </p>
          )}
        </>
      ) : (
        <button
          onClick={() => navigate('/budget', { state: { ym } })}
          className="mt-1 flex w-full items-center justify-between text-left text-[12.5px] text-sub active:opacity-60"
        >
          {label(who)} 생활비·용돈 예산을 넣으면 남은 돈도 보여요
          <ChevronRight size={15} className="shrink-0 text-cap" />
        </button>
      )}

      {count > 0 && (
        <button
          onClick={() => navigate('/monthly')}
          className="mt-2 flex items-center text-[12px] font-bold text-cap active:text-sub"
        >
          이번 달 기록 전부 보기 <ChevronRight size={14} />
        </button>
      )}
    </div>
  )
}
