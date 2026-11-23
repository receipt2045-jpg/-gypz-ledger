import { formatWon } from '../lib/format'
import { shortWon } from './MonthCalendar'

/**
 * 부수입 번 돈 꺾은선 — 최근 몇 달 얼마 벌었는지 (2026-11-24 결영 요청: "그래프로도 꺾은선").
 * 달을 누르면 그 달로 간다.
 */
export default function SideTrend({
  points,
  current,
  onPick,
}: {
  /** 오래된 달부터 */
  points: { ym: string; cash: number }[]
  /** 지금 보고 있는 달 */
  current: string
  onPick: (ym: string) => void
}) {
  if (points.length < 2 || points.every((p) => p.cash === 0)) return null
  const W = 300
  const H = 92
  const TOP = 18 // 점 위 금액 글씨 자리
  const BOTTOM = 6
  const hi = Math.max(...points.map((p) => p.cash)) || 1
  const x = (i: number) => 18 + (i * (W - 36)) / (points.length - 1)
  const y = (v: number) => H - BOTTOM - (v / hi) * (H - TOP - BOTTOM)
  const colW = (W - 36) / (points.length - 1)
  const withMoney = points.filter((p) => p.cash > 0)
  const avg = withMoney.length
    ? Math.round(withMoney.reduce((a, p) => a + p.cash, 0) / withMoney.length)
    : 0
  const label = (ym: string) => `${Number(ym.slice(5, 7))}월`

  return (
    <div className="rounded-card bg-card px-5 py-4 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[14px] font-bold text-ink">
          번 돈 흐름{' '}
          <span className="text-[12px] font-medium text-cap">최근 {points.length}개월</span>
        </p>
        {avg > 0 && (
          <p className="tnum text-[12px] font-semibold text-sub">한 달 평균 {formatWon(avg)}</p>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 block w-full overflow-visible"
        role="img"
        aria-label={`번 돈 흐름 ${points.map((p) => `${label(p.ym)} ${p.cash.toLocaleString()}원`).join(', ')}`}
      >
        <line
          x1={0}
          x2={W}
          y1={H - BOTTOM}
          y2={H - BOTTOM}
          className="stroke-line"
          strokeWidth={1}
        />
        <polygon
          points={[
            `${x(0)},${H - BOTTOM}`,
            ...points.map((p, i) => `${x(i)},${y(p.cash)}`),
            `${x(points.length - 1)},${H - BOTTOM}`,
          ].join(' ')}
          className="fill-emerald-500/10"
        />
        <polyline
          points={points.map((p, i) => `${x(i)},${y(p.cash)}`).join(' ')}
          fill="none"
          className="stroke-emerald-500"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => {
          const on = p.ym === current
          return (
            <g key={p.ym}>
              <circle
                cx={x(i)}
                cy={y(p.cash)}
                r={on ? 4.5 : 3.2}
                className={on ? 'fill-white stroke-emerald-500' : 'fill-emerald-500'}
                strokeWidth={on ? 2.5 : 0}
              />
              {p.cash > 0 && (
                <text
                  x={x(i)}
                  y={y(p.cash) - 8}
                  textAnchor="middle"
                  className={`tnum ${on ? 'fill-emerald-600 font-bold' : 'fill-sub'}`}
                  fontSize={10.5}
                >
                  {shortWon(p.cash)}
                </text>
              )}
              <rect
                x={x(i) - colW / 2}
                y={0}
                width={colW}
                height={H}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => onPick(p.ym)}
              />
            </g>
          )
        })}
      </svg>
      <div className="relative mt-1 h-5 text-[11.5px]">
        {points.map((p, i) => (
          <button
            key={p.ym}
            onClick={() => onPick(p.ym)}
            aria-label={`${label(p.ym)} 부수입 보기`}
            aria-pressed={p.ym === current}
            className={`absolute top-0 -translate-x-1/2 whitespace-nowrap rounded px-1 ${
              p.ym === current ? 'bg-emerald-50 font-bold text-emerald-600' : 'text-cap'
            }`}
            style={{ left: `${(x(i) / W) * 100}%` }}
          >
            {label(p.ym)}
          </button>
        ))}
      </div>
    </div>
  )
}
