import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { abbreviateKRW } from '../lib/format'

/**
 * 순자산 도넛 — 총자산(= 순자산 + 부채)을 두 조각으로 보여준다.
 * 가운데 숫자는 순자산. 아래 범례에 총자산·순자산·부채.
 */
export default function AssetDonut({
  assets,
  debts,
  size = 180,
}: {
  assets: number // 총자산
  debts: number // 부채
  size?: number
}) {
  const netWorth = assets - debts
  // 조각 값 (음수 순자산이면 순자산 조각은 0)
  const data = [
    { name: '순자산', value: Math.max(netWorth, 0), color: '#3182F6' },
    { name: '부채', value: debts, color: '#FF6B6B' },
  ]
  const hasData = assets > 0 || debts > 0

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={hasData ? data : [{ name: '없음', value: 1, color: '#E5E8EB' }]}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={size * 0.34}
              outerRadius={size * 0.48}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              paddingAngle={hasData && debts > 0 && netWorth > 0 ? 2 : 0}
            >
              {(hasData ? data : [{ color: '#E5E8EB' }]).map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* 가운데 순자산 */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] font-medium text-cap">순자산</span>
          <span
            className={`tnum text-[17px] font-extrabold tracking-tight ${netWorth < 0 ? 'text-danger' : 'text-ink'}`}
          >
            {abbreviateKRW(netWorth)}
          </span>
        </div>
      </div>

      {/* 범례 */}
      <div className="mt-3 flex w-full justify-around">
        <Legend label="총자산" value={assets} dot="bg-ink" />
        <Legend label="순자산" value={netWorth} dot="bg-brand" />
        <Legend label="부채" value={debts} dot="bg-[#FF6B6B]" danger />
      </div>
    </div>
  )
}

function Legend({
  label,
  value,
  dot,
  danger,
}: {
  label: string
  value: number
  dot: string
  danger?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="flex items-center gap-1 text-[11px] text-sub">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
      <span className={`tnum text-[13px] font-bold ${danger ? 'text-danger' : 'text-ink'}`}>
        {danger && value > 0 ? '−' : ''}
        {abbreviateKRW(Math.abs(value))}
      </span>
    </div>
  )
}
