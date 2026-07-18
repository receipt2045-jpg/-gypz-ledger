// 홈 상단 미니 게이지 4종 (채움가계부 스타일 대시보드)
// 링 = 비율, 가운데 = 값. 순수 SVG라 가볍다.

function shortWon(n: number): string {
  const abs = Math.abs(n)
  const man = Math.round(abs / 10000)
  if (man >= 10000) return `${(man / 10000).toFixed(1)}억`
  return `${man.toLocaleString('ko-KR')}만`
}

function Ring({
  ratio,
  value,
  label,
  color,
}: {
  ratio: number // 0~1 (초과는 1로 캡)
  value: string
  label: string
  color: string
}) {
  const size = 66
  const stroke = 6
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(ratio, 1))
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E8EB" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
          />
        </svg>
        <span className="tnum absolute inset-0 flex items-center justify-center text-[12px] font-extrabold text-ink">
          {value}
        </span>
      </div>
      <span className="text-[11px] font-medium text-sub">{label}</span>
    </div>
  )
}

export default function StatGauges({
  income,
  expense,
  savingInvestRate,
  netWorth,
  targetNetWorth,
}: {
  income: number
  expense: number
  savingInvestRate: number
  netWorth: number
  targetNetWorth: number
}) {
  const spendRatio = income > 0 ? expense / income : 0
  const targetRatio = targetNetWorth > 0 ? netWorth / targetNetWorth : 0
  return (
    <div className="grid grid-cols-4 gap-1 rounded-card bg-card px-2 py-4 shadow-card">
      <Ring ratio={1} value={shortWon(income)} label="수입" color="#3182F6" />
      <Ring
        ratio={spendRatio}
        value={shortWon(expense)}
        label="지출"
        color={spendRatio > 1 ? '#FF6B6B' : '#F5A623'}
      />
      <Ring
        ratio={savingInvestRate}
        value={`${Math.round(savingInvestRate * 100)}%`}
        label="저축·투자율"
        color="#22C55E"
      />
      <Ring ratio={targetRatio} value={shortWon(netWorth)} label="순자산" color="#8B5CF6" />
    </div>
  )
}
