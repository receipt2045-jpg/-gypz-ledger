import { useEffect, useState } from 'react'
import { formatWon } from '../lib/format'
import { shortWon } from './MonthCalendar'

/**
 * 부수입 꺾은선 — 최근 몇 달 번 돈(초록)·쓴 돈(빨강) (2026-11-24 결영 요청: "그래프로도 꺾은선",
 * "쓴 돈도 같이, 올해 번 돈을 강조하고 이 달 번 돈은 그 아래로"). 달을 누르면 그 달로 간다.
 *
 * 그림 너비를 실제 칸 너비에 맞춘다 — 예전엔 300칸짜리 그림을 화면 너비만큼 늘려서
 * PC 넓은 화면에선 글씨·점·높이까지 같이 커졌다.
 */
export default function SideTrend({
  points,
  current,
  onPick,
  yearCash,
  monthCash,
  monthSpent,
}: {
  /** 오래된 달부터 */
  points: { ym: string; cash: number; spent: number }[]
  /** 지금 보고 있는 달 */
  current: string
  onPick: (ym: string) => void
  /** 올해(보는 달까지) 번 돈 */
  yearCash: number
  /** 보는 달 번 돈·쓴 돈 */
  monthCash: number
  monthSpent: number
}) {
  // 칸이 나중에 생겨도(기록을 불러온 뒤) 재도록 ref 대신 state로 받는다
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [W, setW] = useState(300)
  useEffect(() => {
    const el = box
    if (!el) return
    const fit = () => {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w > 0) setW(w)
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [box])

  const hasSpent = points.some((p) => p.spent > 0)
  if (points.length < 2 || points.every((p) => p.cash === 0 && p.spent === 0)) return null
  const H = 120
  const TOP = 20 // 점 위 금액 글씨 자리
  const BOTTOM = 6
  const PAD = 22
  const hi = Math.max(...points.map((p) => Math.max(p.cash, p.spent))) || 1
  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (points.length - 1)
  const y = (v: number) => H - BOTTOM - (v / hi) * (H - TOP - BOTTOM)
  const colW = (W - PAD * 2) / (points.length - 1)
  const label = (ym: string) => `${Number(ym.slice(5, 7))}월`
  const line = (key: 'cash' | 'spent') => points.map((p, i) => `${x(i)},${y(p[key])}`).join(' ')

  return (
    <div className="rounded-card bg-card px-5 py-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-cap">{current.slice(0, 4)}년 번 돈</p>
          <p className="tnum mt-0.5 text-[24px] font-extrabold leading-tight text-emerald-600">
            {formatWon(yearCash)}
          </p>
          <p className="tnum mt-1 text-[12.5px] text-sub">
            {label(current)} 번 돈 <b className="text-ink">{formatWon(monthCash)}</b>
            {monthSpent > 0 && (
              <>
                {' · '}쓴 돈 <b className="text-rose-600">{formatWon(monthSpent)}</b>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 pt-0.5 text-[11.5px] font-semibold text-sub">
          <span className="flex items-center gap-1">
            <i className="inline-block h-[3px] w-3 rounded-full bg-emerald-500" /> 번 돈
          </span>
          {hasSpent && (
            <span className="flex items-center gap-1">
              <i className="inline-block h-[3px] w-3 rounded-full bg-rose-400" /> 쓴 돈
            </span>
          )}
        </div>
      </div>
      <div ref={setBox} className="mt-3">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block overflow-visible"
          role="img"
          aria-label={`최근 ${points.length}개월 부수입 ${points
            .map(
              (p) =>
                `${label(p.ym)} 번 돈 ${p.cash.toLocaleString()}원${
                  p.spent ? ` 쓴 돈 ${p.spent.toLocaleString()}원` : ''
                }`,
            )
            .join(', ')}`}
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
            points={`${x(0)},${H - BOTTOM} ${line('cash')} ${x(points.length - 1)},${H - BOTTOM}`}
            className="fill-emerald-500/10"
          />
          {hasSpent && (
            <polyline
              points={line('spent')}
              fill="none"
              className="stroke-rose-400"
              strokeWidth={2}
              strokeDasharray="4 3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          <polyline
            points={line('cash')}
            fill="none"
            className="stroke-emerald-500"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((p, i) => {
            const on = p.ym === current
            // 쓴 돈 금액은 점 아래에 — 번 돈 금액과 겹치지 않게
            const spentBelow = y(p.spent) + 13 <= H - BOTTOM - 2
            return (
              <g key={p.ym}>
                {hasSpent && p.spent > 0 && (
                  <>
                    <circle cx={x(i)} cy={y(p.spent)} r={2.6} className="fill-rose-400" />
                    {Math.abs(y(p.spent) - y(p.cash)) > 14 && (
                      <text
                        x={x(i)}
                        y={spentBelow ? y(p.spent) + 13 : y(p.spent) - 7}
                        textAnchor="middle"
                        className={`tnum ${on ? 'fill-rose-600 font-bold' : 'fill-rose-400'}`}
                        fontSize={10}
                      >
                        {shortWon(p.spent)}
                      </text>
                    )}
                  </>
                )}
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
      </div>
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
            style={{ left: x(i) }}
          >
            {label(p.ym)}
          </button>
        ))}
      </div>
    </div>
  )
}
