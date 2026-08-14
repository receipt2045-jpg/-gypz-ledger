import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { abbreviateKRW } from '../lib/format'

export interface NetWorthPoint {
  label: string
  value: number
}

/**
 * 순자산 추이 곡선 (자산 탭).
 *
 * 자산 화면에서 떼어냈다 — recharts가 앱에서 제일 무거운 부품이라
 * 그래프를 쓰는 화면에서만 받아오게 하려면 별도 파일이어야 한다.
 */
export default function NetWorthChart({ series }: { series: NetWorthPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={series} margin={{ top: 8, right: 6, bottom: 0, left: 6 }}>
        <defs>
          <linearGradient id="assetArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3182F6" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#3182F6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#8B95A1' }}
          axisLine={false}
          tickLine={false}
          dy={4}
        />
        <YAxis hide domain={['dataMin - 5000000', 'dataMax + 5000000']} />
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
          fill="url(#assetArea)"
          dot={{ r: 3, fill: '#3182F6', stroke: '#fff', strokeWidth: 1.5 }}
          activeDot={{ r: 5, fill: '#3182F6', stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
