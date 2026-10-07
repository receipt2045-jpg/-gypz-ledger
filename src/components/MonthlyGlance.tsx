import { summarize } from '../lib/carryover'
import { formatMonthKorean } from '../lib/format'
import type { MonthlyLedger, Profile } from '../types'
import { Ring, shortWon } from './StatGauges'

const MEMBER_HEX: Record<string, string> = {
  blue: '#3182F6',
  pink: '#EC4899',
  green: '#10B981',
  purple: '#8B5CF6',
  orange: '#F97316',
  slate: '#64748B',
}
const DEFAULT_HEX: [string, string] = ['#3182F6', '#EC4899']

/**
 * 가계부 탭 '한눈에' (2026-10-07 제보: "한눈에 안 들어와요").
 * 맨 위에 남는 돈, 그 아래 홈 탭처럼 링 네 개(수입·저축·투자·고정비·생활비), 누가 얼마나 벌었나.
 * 항목별 목록은 이 아래 '자세히'에서 펼쳐 본다.
 */
export default function MonthlyGlance({
  ledger,
  profile,
}: {
  ledger: MonthlyLedger
  profile: Profile
}) {
  const s = summarize(ledger)
  const save = s.saving + s.investment
  const pct = (n: number) => (s.income > 0 ? Math.round((n / s.income) * 100) : 0)
  const ratio = (n: number) => (s.income > 0 ? n / s.income : 0)

  const earned = ([1, 2] as const).map(
    (m) => summarize({ ...ledger, items: ledger.items.filter((it) => it.member === m) }).income,
  )
  const colors = ([1, 2] as const).map(
    (m) =>
      MEMBER_HEX[(m === 1 ? profile.member1Color : profile.member2Color) ?? ''] ??
      DEFAULT_HEX[m - 1],
  )

  return (
    <div className="rounded-card bg-card px-5 py-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] text-sub">{formatMonthKorean(ledger.ym)} 남는 돈</p>
          <p
            className={`tnum text-[28px] font-extrabold tracking-tight ${
              s.surplus < 0 ? 'text-danger' : 'text-brand'
            }`}
          >
            {s.surplus < 0 ? `${shortWon(-s.surplus)}원 넘쳐요` : `${shortWon(s.surplus)}원`}
          </p>
        </div>
        <span className="mt-1 shrink-0 rounded-full bg-bg px-2.5 py-1 text-[11.5px] font-medium text-sub">
          {ledger.closed ? '정산 끝 · 실제' : '정산 전 · 계획 기준'}
        </span>
      </div>
      <p className="tnum mt-0.5 text-[12px] text-cap">
        수입 {shortWon(s.income)} − 저축·투자 {shortWon(save)} − 고정비 {shortWon(s.fixed)} − 생활비{' '}
        {shortWon(s.variable)}
      </p>

      <div className="mt-4 grid grid-cols-4 gap-1">
        <Ring ratio={1} value={shortWon(s.income)} label="수입" color="#3182F6" />
        <Ring
          ratio={ratio(save)}
          value={shortWon(save)}
          label="저축·투자"
          sub={`수입의 ${pct(save)}%`}
          color="#22C55E"
        />
        <Ring
          ratio={ratio(s.fixed)}
          value={shortWon(s.fixed)}
          label="고정비"
          sub={`수입의 ${pct(s.fixed)}%`}
          color={ratio(s.fixed) > 0.5 ? '#FF6B6B' : '#F5A623'}
        />
        <Ring
          ratio={ratio(s.variable)}
          value={shortWon(s.variable)}
          label="생활비"
          sub={`수입의 ${pct(s.variable)}%`}
          color="#8B5CF6"
        />
      </div>

      {earned[0] + earned[1] > 0 && (
        <div className="mt-4 flex items-center gap-4 border-t border-bg pt-4">
          <SplitDonut values={earned} colors={colors} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-[12.5px] font-bold text-sub">누가 얼마나 벌었나</p>
            {([1, 2] as const).map((m) => (
              <div key={m} className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-1.5 text-ink">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: colors[m - 1] }}
                  />
                  {m === 1 ? profile.member1Name : profile.member2Name}
                </span>
                <span className="tnum font-semibold text-ink">
                  {shortWon(earned[m - 1])}
                  <span className="ml-1 text-[12px] font-normal text-cap">
                    {Math.round((earned[m - 1] / (earned[0] + earned[1])) * 100)}%
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** 두 사람 몫을 한 원에 — 첫 사람이 12시부터 시계 방향 */
function SplitDonut({ values, colors }: { values: number[]; colors: string[] }) {
  const size = 66
  const stroke = 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const total = values[0] + values[1]
  const first = total > 0 ? values[0] / total : 0
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90" aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={colors[1]}
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={colors[0]}
        strokeWidth={stroke}
        strokeDasharray={`${c * first} ${c}`}
      />
    </svg>
  )
}
