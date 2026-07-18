import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { abbreviateKRW } from '../lib/format'

export interface MonthPoint {
  label: string // "7월"
  expense: number // 월 지출
  netWorth: number // 순자산
}

/** 월별 지출(막대) + 순자산(꺾은선) 콤보 — 채움가계부 대시보드 스타일 */
export default function MonthlyCombo({ data }: { data: MonthPoint[] }) {
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 4, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} stroke="#F2F4F6" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#8B95A1' }}
            axisLine={false}
            tickLine={false}
            dy={4}
          />
          {/* 왼쪽: 지출 막대 스케일 / 오른쪽: 순자산 라인 스케일 (숨김) */}
          <YAxis yAxisId="expense" hide />
          <YAxis yAxisId="nw" orientation="right" hide domain={['dataMin', 'dataMax']} />
          <Tooltip
            cursor={{ fill: 'rgba(49,130,246,0.06)' }}
            content={({ active, payload }) =>
              active && payload && payload.length ? (
                <div className="space-y-0.5 rounded-lg bg-ink px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-lg">
                  <p>지출 {abbreviateKRW(Number(payload.find((p) => p.dataKey === 'expense')?.value ?? 0))}</p>
                  <p className="text-white/70">
                    순자산 {abbreviateKRW(Number(payload.find((p) => p.dataKey === 'netWorth')?.value ?? 0))}
                  </p>
                </div>
              ) : null
            }
          />
          <Bar yAxisId="expense" dataKey="expense" fill="#C7D7F5" radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Line
            yAxisId="nw"
            type="monotone"
            dataKey="netWorth"
            stroke="#3182F6"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#3182F6', stroke: '#fff', strokeWidth: 1.5 }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-1 flex justify-center gap-4 text-[11px] text-sub">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-[#C7D7F5]" /> 월 지출
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-brand" /> 순자산
        </span>
      </div>
    </div>
  )
}
