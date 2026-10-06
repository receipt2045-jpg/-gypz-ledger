import type { ReactNode } from 'react'

/**
 * PC(가로 1024px 이상)에서만 두 칸으로 나눈다 (2026-10-06).
 * 폰에서는 왼쪽 칸 다음 오른쪽 칸 — 지금 순서 그대로 한 줄로 내려간다.
 * 그래서 나눌 때는 '위쪽 절반 / 아래쪽 절반'으로 자른다.
 */
export default function PcColumns({
  left,
  right,
  wide = 'even',
}: {
  left: ReactNode
  right: ReactNode
  /** 왼쪽을 더 넓게(3:2) — 읽을거리가 왼쪽일 때 */
  wide?: 'even' | 'left'
}) {
  return (
    <div
      className={`space-y-4 lg:grid lg:items-start lg:gap-6 lg:space-y-0 ${
        wide === 'left' ? 'lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]' : 'lg:grid-cols-2'
      }`}
    >
      <div className="min-w-0 space-y-4">{left}</div>
      <div className="min-w-0 space-y-4">{right}</div>
    </div>
  )
}
