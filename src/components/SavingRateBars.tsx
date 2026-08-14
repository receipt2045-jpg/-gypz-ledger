import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'

export interface RatePoint {
  label: string
  rate: number
  has: boolean
}

/**
 * 월별 저축률 막대 (연간 리포트).
 *
 * 연간 리포트 화면에서 떼어냈다 — 그래프를 보는 화면에서만
 * recharts를 받아오게 하려면 별도 파일이어야 한다.
 */
export default function SavingRateBars({ data }: { data: RatePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: '#8B95A1' }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: 'rgba(49,130,246,0.06)' }}
          content={({ active, payload }) =>
            active && payload && payload.length ? (
              <div className="rounded-lg bg-ink px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-lg">
                {payload[0].payload.label} {payload[0].value}%
              </div>
            ) : null
          }
        />
        <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={18}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.has ? '#3182F6' : '#E5E8EB'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
