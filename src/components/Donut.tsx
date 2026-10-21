/**
 * 원 그래프 (2026-10-21 의견: "예전처럼 자산을 부동산·현금·주식으로 나눈 동그라미 그래프로 보고 싶어요").
 * 조각마다 색을 입힌 도넛. 가운데에 큰 글자 하나를 둘 수 있다. 순수 SVG라 가볍다.
 */
export default function Donut({
  segments,
  size = 128,
  stroke = 20,
  center,
  sub,
  label,
}: {
  segments: { value: number; color: string }[]
  size?: number
  stroke?: number
  /** 가운데 큰 글자 */
  center?: string
  /** 가운데 작은 글자 (위) */
  sub?: string
  label: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0)
  // 조각 사이 틈 — 조각이 하나뿐이면 틈 없이 꽉 채운다
  const gap = segments.filter((s) => s.value > 0).length > 1 ? 2 : 0
  let offset = 0
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#F2F4F6"
          strokeWidth={stroke}
        />
        {total > 0 &&
          segments.map((s, i) => {
            if (s.value <= 0) return null
            const len = (s.value / total) * c
            const dash = Math.max(0.5, len - gap)
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
              />
            )
            offset += len
            return el
          })}
      </svg>
      {(center || sub) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {sub && <span className="text-[11px] text-cap">{sub}</span>}
          {center && <span className="tnum text-[14px] font-extrabold text-ink">{center}</span>}
        </div>
      )}
    </div>
  )
}
