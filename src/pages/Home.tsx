import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, Check, ChevronLeft, ChevronRight, Settings, TrendingUp } from 'lucide-react'
import Card from '../components/Card'
import InfoTip from '../components/InfoTip'
import MonthlyCombo, { type MonthPoint } from '../components/MonthlyCombo'
import ProgressBar from '../components/ProgressBar'
import StatGauges from '../components/StatGauges'
import { useLedgerStore } from '../lib/store'
import {
  activeYm,
  netWorthOf,
  netWorthSeries,
  resolveLedger,
  resolveSnapshot,
  summarize,
} from '../lib/carryover'
import {
  abbreviateKRW,
  formatMonthKorean,
  formatPercent,
  formatWon,
  formatYmKorean,
  shiftYm,
  signedAbbrev,
} from '../lib/format'
import { TERM_TIP } from '../lib/constants'

/**
 * 홈 = 대시보드만. 기록(고백·예산·정산·자산 등록)은 각 탭에서:
 * 고백 → 하단 가운데 탭 / 예산·정산 → 가계부 탭 / 자산 등록 → 자산 탭
 */
export default function Home() {
  const navigate = useNavigate()
  const { ledgers, snapshots, profile } = useLedgerStore()

  // 보고 있는 달 — 정산해도 자동으로 넘어가지 않고, ◀▶로 직접 선택
  const latestLedgerYm = ledgers.length ? ledgers[ledgers.length - 1].ym : activeYm(ledgers)
  const [ym, setYm] = useState(latestLedgerYm)
  const maxYm = shiftYm(latestLedgerYm, 1) // 다음 달까지(예산 미리보기)

  const ledger = resolveLedger(ledgers, ym)
  const s = summarize(ledger)

  const snapshot = resolveSnapshot(snapshots, ym)
  const netWorth = netWorthOf(snapshot)
  const series = netWorthSeries(snapshots, ym, 6)
  const prev = series.length >= 2 ? series[series.length - 2].value : netWorth
  const delta = signedAbbrev(netWorth - prev)

  // 최근 6개월 지출·순자산 콤보 데이터
  const combo: MonthPoint[] = series.map((pt) => ({
    label: formatMonthKorean(pt.ym),
    expense: summarize(resolveLedger(ledgers, pt.ym)).expense,
    netWorth: pt.value,
  }))

  const targetRatio = profile.targetNetWorth > 0 ? netWorth / profile.targetNetWorth : 0
  const settledMembers = ledger.settledMembers ?? []
  const memberNames: [string, string] = [profile.member1Name, profile.member2Name]

  return (
    <div className="animate-fade-up space-y-4 pb-24">
      {/* 달 선택 + 설정 */}
      <div className="relative flex items-center justify-center gap-3 pt-2">
        <button
          onClick={() => setYm(shiftYm(ym, -1))}
          className="flex h-8 w-8 items-center justify-center rounded-full text-sub active:bg-line"
          aria-label="이전 달"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="min-w-[110px] text-center text-[16px] font-bold text-ink">
          {formatYmKorean(ym)}
        </span>
        <button
          onClick={() => setYm(shiftYm(ym, 1))}
          disabled={ym >= maxYm}
          className="flex h-8 w-8 items-center justify-center rounded-full text-sub active:bg-line disabled:opacity-25"
          aria-label="다음 달"
        >
          <ChevronRight size={20} />
        </button>
        <div className="absolute right-0 flex items-center">
          <button
            onClick={() => navigate('/yearly')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-cap active:bg-line"
            aria-label="연간 리포트"
          >
            <BarChart3 size={19} />
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="flex h-8 w-8 items-center justify-center rounded-full text-cap active:bg-line"
            aria-label="설정"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* 순자산 헤더 */}
      <header className="px-1">
        <p className="text-[13px] text-cap">
          {formatMonthKorean(ym)} 순자산
          <InfoTip text={TERM_TIP.netWorth} />
        </p>
        <h1 className="tnum mt-1 text-[34px] font-extrabold leading-tight tracking-tight text-ink">
          {abbreviateKRW(netWorth)}
        </h1>
        <p className={`mt-1 text-[14px] font-semibold ${delta.zero ? 'text-cap' : delta.positive ? 'text-brand' : 'text-danger'}`}>
          지난달보다 {delta.zero ? '변동 없음' : delta.text}
        </p>
      </header>

      {/* 미니 게이지 4종 (수입·지출·저축률·순자산) */}
      <StatGauges
        income={s.income}
        expense={s.expense}
        savingInvestRate={s.savingInvestRate}
        netWorth={netWorth}
        targetNetWorth={profile.targetNetWorth}
      />

      {/* 자산이 하나도 없으면 자산 등록부터 안내 */}
      {snapshot.items.length === 0 && (
        <Card onClick={() => navigate('/asset-setup')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold text-ink">먼저 우리집 자산을 등록해 보세요</p>
              <p className="mt-1 text-[13px] text-sub">
                어떤 통장에 얼마 있는지 넣으면 순자산이 보여요
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-cap" />
          </div>
        </Card>
      )}

      {/* 잉여현금 + 정산 상태 */}
      <Card onClick={() => navigate('/monthly')}>
        {ledger.closed ? (
          <>
            <p className="text-[13px] font-medium text-cap">
              {formatMonthKorean(ym)} 잉여현금
              <InfoTip text={TERM_TIP.surplus} />
            </p>
            <p
              className={`tnum mt-1 text-[24px] font-extrabold ${s.surplus < 0 ? 'text-danger' : 'text-ink'}`}
            >
              {formatWon(s.surplus)}
            </p>
            <p className="mt-1.5 text-[14px] font-medium text-sub">
              {s.surplus === 0
                ? '완벽해요 👏 한 푼도 남김없이 계획됐어요'
                : s.surplus > 0
                  ? `아직 ${formatWon(s.surplus)}이 계획되지 않았어요`
                  : `${formatWon(-s.surplus)}만큼 초과 지출됐어요`}
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-bold text-ink">
                아직 {formatMonthKorean(ym)} 정산 전입니다
              </p>
              <ChevronRight size={18} className="shrink-0 text-cap" />
            </div>
            <p className="mt-1.5 text-[14px] font-medium text-sub">
              가계부 탭에서 예산을 세우고 정산해 보세요 🤍
            </p>
          </>
        )}
        {/* 부부 정산 상태 */}
        <div className="mt-3 flex gap-2 border-t border-line pt-3">
          {([1, 2] as const).map((m) => {
            const done = settledMembers.includes(m)
            return (
              <span
                key={m}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ${
                  done ? 'bg-brand/10 text-brand' : 'bg-bg text-cap'
                }`}
              >
                {done && <Check size={12} />}
                {memberNames[m - 1]} {done ? '완료' : '대기'}
              </span>
            )
          })}
        </div>
      </Card>

      {/* 월별 지출·순자산 콤보 차트 */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-medium text-cap">최근 6개월 지출·순자산</p>
          <TrendingUp size={16} className="text-brand" />
        </div>
        <MonthlyCombo data={combo} />
      </Card>

      {/* 10년 목표 진행바 */}
      <Card onClick={() => navigate('/assets')}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[15px] font-bold text-ink">10년 목표 순자산</p>
          <ChevronRight size={18} className="text-cap" />
        </div>
        <div className="mb-2 flex items-end justify-between">
          <span className="tnum text-[20px] font-extrabold text-brand">
            {formatPercent(targetRatio)}
          </span>
          <span className="tnum text-[13px] font-medium text-sub">
            목표 {abbreviateKRW(profile.targetNetWorth)}
          </span>
        </div>
        <ProgressBar ratio={targetRatio} />
        {profile.targetNetWorth > netWorth && (
          <p className="mt-2 text-[13px] font-medium text-sub">
            목표까지 <b className="tnum text-brand">{abbreviateKRW(profile.targetNetWorth - netWorth)}</b>{' '}
            남았어요. 이 속도라면 곧 도착이에요 💪
          </p>
        )}
        {profile.targetNetWorth > 0 && netWorth >= profile.targetNetWorth && (
          <p className="mt-2 text-[13px] font-bold text-brand">🎉 10년 목표를 달성했어요! 대단해요</p>
        )}
      </Card>
    </div>
  )
}
