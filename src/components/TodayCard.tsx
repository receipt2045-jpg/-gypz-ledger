import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useLedgerStore } from '../lib/store'
import { resolveLedger } from '../lib/carryover'
import { monthConfessions } from '../lib/confessLedger'
import { streakOf } from '../lib/reactions'
import { cardSpentFromConfessions, readYearEndInput, recommendCard } from '../lib/yearEndTax'
import { abbreviateKRW, currentYm } from '../lib/format'

const dayKey = (d: Date) => d.toLocaleDateString('sv-SE')

/**
 * 오늘 카드 — 매일의 행동(고백)이 큰 그림(예산·연말정산)에 어떻게 닿는지
 * 한 카드에서 보여준다. 홈이 대시보드(숲)라면 이 카드는 오늘 할 일(나무).
 *
 * 세 줄: ① 고백 스트릭 ② 변동지출 게이지(고백 누적 ÷ 예산) ③ 오늘 쓸 카드
 */
export default function TodayCard() {
  const navigate = useNavigate()
  const { confessions, memberNo, ledgers, profile } = useLedgerStore()

  const me = memberNo ?? 1
  const thisYm = currentYm()
  const today = dayKey(new Date())

  // ① 고백 줄
  const streak = streakOf(confessions, me)
  const confessedToday = confessions.some(
    (c) => c.memberNo === me && dayKey(new Date(c.createdAt)) === today,
  )

  // ② 게이지 줄 — 부부가 이번 달 고백한 변동지출 합 ÷ 변동지출 예산 합
  const budget = resolveLedger(ledgers, thisYm)
    .items.filter((it) => it.group === 'variable')
    .reduce((sum, it) => sum + it.planned, 0)
  const confessed = monthConfessions(confessions, thisYm)
    .filter((c) => c.kind === 'variable')
    .reduce((sum, c) => sum + c.amount, 0)
  const ratio = budget > 0 ? confessed / budget : 0
  const over = budget > 0 && confessed > budget

  // ③ 카드 줄 — 연말정산 입력이 있으면 오늘 유리한 카드
  const yearEnd = readYearEndInput()
  // 고백에 카드 주인을 남긴 만큼은 직접 입력분에 더해서 본다
  const cardFromApp = cardSpentFromConfessions(confessions)
  const hasSalary = yearEnd.gross1 > 0 && yearEnd.gross2 > 0
  const advice = hasSalary
    ? recommendCard(
        { gross: yearEnd.gross1, spent: yearEnd.spent1 + cardFromApp[0] },
        { gross: yearEnd.gross2, spent: yearEnd.spent2 + cardFromApp[1] },
      )
    : null
  const cardLabel = !advice
    ? null
    : advice.winner === 1
      ? `${profile.member1Name} 카드`
      : advice.winner === 2
        ? `${profile.member2Name} 카드`
        : advice.winner === 'either'
          ? '어느 쪽이든 비슷해요'
          : '혜택 좋은 카드'

  return (
    <div className="rounded-card bg-card shadow-card">
      {/* ① 고백 */}
      <button
        onClick={() => navigate('/confess')}
        className="flex w-full items-center justify-between px-4 py-3 text-left active:bg-bg"
      >
        <span className="text-[14px] font-bold text-ink">
          {streak > 0 ? `🔥 ${streak}일 연속` : '🎙️ 오늘의 고백'}
          <span className={`ml-1.5 font-semibold ${confessedToday ? 'text-brand' : 'text-sub'}`}>
            {confessedToday ? '· 오늘 고백 끝 ✅' : streak > 0 ? '· 오늘 고백 아직이에요' : '오늘 쓴 돈을 말해주세요'}
          </span>
        </span>
        <span className="flex shrink-0 items-center text-[13px] font-bold text-brand">
          고백 <ChevronRight size={15} />
        </span>
      </button>

      {/* ② 변동지출 게이지 */}
      <div className="border-t border-line px-4 py-3">
        {budget > 0 ? (
          <>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[12.5px] font-medium text-sub">이번 달 변동지출</span>
              <span className="tnum text-[12.5px] font-bold text-ink">
                {abbreviateKRW(confessed)} <span className="font-medium text-cap">/ {abbreviateKRW(budget)}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div
                className={`h-full rounded-full transition-all ${over ? 'bg-danger' : 'bg-brand'}`}
                style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11.5px] text-cap">
              {over
                ? `예산보다 ${abbreviateKRW(confessed - budget)} 넘었어요 · 모아가 할 말이 있대요`
                : `고백한 만큼 채워져요 · ${abbreviateKRW(budget - confessed)} 남음`}
            </p>
          </>
        ) : (
          <button
            onClick={() => navigate('/checkup', { state: { ym: thisYm, mode: 'budget' } })}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-[13px] font-medium text-sub">
              이번 달 예산부터 세워볼까요? 고백이 게이지로 쌓여요
            </span>
            <ChevronRight size={15} className="shrink-0 text-cap" />
          </button>
        )}
      </div>

      {/* ③ 오늘 쓸 카드 */}
      <button
        onClick={() => navigate('/year-end-tax')}
        className="flex w-full items-center justify-between border-t border-line px-4 py-3 text-left active:bg-bg"
      >
        {cardLabel ? (
          <>
            <span className="text-[14px] text-ink">
              💳 오늘 긁을 땐 <b className="font-bold text-brand">{cardLabel}</b>
            </span>
            <span className="flex shrink-0 items-center text-[12.5px] font-medium text-cap">
              왜? <ChevronRight size={15} />
            </span>
          </>
        ) : (
          <>
            {/* 할 일(연봉 입력)을 앞세우지 않는다. 궁금한 것부터 묻고 방법은 아래 줄에 */}
            <span className="min-w-0">
              <span className="block text-[14px] font-bold text-ink">
                💳 {profile.member1Name} 카드 쓸까, {profile.member2Name} 카드 쓸까?
              </span>
              <span className="mt-0.5 block text-[12px] text-cap">
                연말정산 대비 · 연봉 두 개만 넣으면 알려드려요
              </span>
            </span>
            <ChevronRight size={15} className="shrink-0 text-cap" />
          </>
        )}
      </button>
    </div>
  )
}
