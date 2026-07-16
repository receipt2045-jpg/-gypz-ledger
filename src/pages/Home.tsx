import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Check, ChevronRight, TrendingUp } from 'lucide-react'
import Card from '../components/Card'
import ProgressBar from '../components/ProgressBar'
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
  signedAbbrev,
} from '../lib/format'

export default function Home() {
  const navigate = useNavigate()
  const { ledgers, snapshots, profile } = useLedgerStore()

  const ym = activeYm(ledgers)
  const ledger = resolveLedger(ledgers, ym)
  const s = summarize(ledger)

  const snapshot = resolveSnapshot(snapshots, ym)
  const netWorth = netWorthOf(snapshot)
  const series = netWorthSeries(snapshots, ym, 6)
  const prev = series.length >= 2 ? series[series.length - 2].value : netWorth
  const delta = signedAbbrev(netWorth - prev)

  const targetRatio = profile.targetNetWorth > 0 ? netWorth / profile.targetNetWorth : 0

  const settledMembers = ledger.settledMembers ?? []
  const memberNames: [string, string] = [profile.member1Name, profile.member2Name]

  return (
    <>
    <div className="animate-fade-up space-y-4 pb-24">
      {/* 헤더 + 순자산 큰 숫자 */}
      <header className="px-1 pt-2">
        <p className="text-[15px] font-semibold text-sub">
          {formatMonthKorean(ym)} 우리집 돈 흐름
        </p>
        <p className="mt-1 text-[13px] text-cap">이번 달 순자산</p>
        <h1 className="tnum mt-1 text-[34px] font-extrabold leading-tight tracking-tight text-ink">
          {abbreviateKRW(netWorth)}
        </h1>
        <p className={`mt-1 text-[14px] font-semibold ${delta.zero ? 'text-cap' : delta.positive ? 'text-brand' : 'text-danger'}`}>
          지난달보다 {delta.zero ? '변동 없음' : delta.text}
        </p>
      </header>

      {/* 카드 1 — 이번 달 요약 */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-ink">{formatMonthKorean(ym)} 요약</h2>
          <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[12px] font-bold text-brand">
            저축·투자율 {formatPercent(s.savingInvestRate)}
          </span>
        </div>
        <div className="space-y-2.5">
          <SummaryRow label="수입" amount={s.income} accent="text-brand" />
          <SummaryRow label="저축" amount={s.saving} />
          <SummaryRow label="투자" amount={s.investment} />
          <SummaryRow label="지출" amount={s.expense} />
        </div>
      </Card>

      {/* 카드 2 — 잉여현금 (미정산이면 칭찬 대신 시작 안내 — 브리프 P0 1.3) */}
      <Card>
        {ledger.closed ? (
          <>
            <p className="text-[13px] font-medium text-cap">이번 달 잉여현금</p>
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
            <p className="text-[15px] font-bold text-ink">아직 이번 달 정산 전입니다</p>
            <p className="mt-1.5 text-[14px] font-medium text-sub">
              '이번 달 정산하기'로 시작하실 분! 🤍
            </p>
          </>
        )}
      </Card>

      {/* 카드 3 — 순자산 추이 미니 차트 */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-medium text-cap">최근 6개월 순자산 추이</p>
          <TrendingUp size={16} className="text-brand" />
        </div>
        <div className="h-28 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="homeArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3182F6" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#3182F6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Tooltip
                cursor={{ stroke: '#3182F6', strokeWidth: 1, strokeDasharray: '3 3' }}
                content={({ active, payload }) =>
                  active && payload && payload.length ? (
                    <div className="rounded-lg bg-ink px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-lg">
                      {abbreviateKRW(Number(payload[0].value))}
                    </div>
                  ) : null
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3182F6"
                strokeWidth={2.5}
                fill="url(#homeArea)"
                dot={false}
                activeDot={{ r: 4, fill: '#3182F6', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 카드 4 — 10년 목표 진행바 */}
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
      </Card>

    </div>

    {/* 하단 고정 CTA — 애니메이션(transform) 컨테이너 밖에 두어야 fixed가 뷰포트 기준으로 동작 */}
    <div className="pointer-events-none fixed bottom-[70px] left-1/2 z-20 w-full max-w-app -translate-x-1/2 px-5">
      <div className="pointer-events-auto mb-2 flex justify-center gap-2">
        {([1, 2] as const).map((m) => {
          const done = settledMembers.includes(m)
          return (
            <span
              key={m}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold shadow-card ${
                done ? 'bg-brand text-white' : 'bg-white text-sub'
              }`}
            >
              {done && <Check size={13} />}
              {memberNames[m - 1]} {done ? '완료' : '대기'}
            </span>
          )
        })}
      </div>
      <button
        onClick={() => navigate('/checkup')}
        className="pointer-events-auto h-14 w-full rounded-btn bg-brand text-[16px] font-bold text-white shadow-cta transition-colors active:bg-brand-dark"
      >
        이번 달 정산하기
      </button>
    </div>
    </>
  )
}

function SummaryRow({
  label,
  amount,
  accent = 'text-ink',
}: {
  label: string
  amount: number
  accent?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[15px] text-sub">{label}</span>
      <span className={`tnum text-[16px] font-semibold ${accent}`}>{formatWon(amount)}</span>
    </div>
  )
}
