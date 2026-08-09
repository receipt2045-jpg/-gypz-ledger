/**
 * 또래 기준값 — 모아불리를 쓰는 부부들은 이 항목에 보통 얼마를 쓰는가.
 *
 * 순위(상위 몇 %)도, 표본 수(30집 중)도 보여주지 않는다.
 *   - 순위는 하위권 사용자를 위축시키기만 하고 행동으로 이어지지 않는다.
 *   - 표본 수를 드러내면 "겨우 30집?"이 되어 오히려 신뢰를 깎는다.
 * 대신 중간값 하나만 조용히 놓아둔다. 판단은 사용자가 한다.
 *
 * 표본이 적을 때는 아무 말도 하지 않는다. 다섯 집의 중간값은 통계가 아니다.
 */

/** 이만큼 모여야 중간값을 말할 자격이 생긴다 */
export const MIN_SAMPLE = 20

export interface PeerRow {
  category: string
  n: number
  my_amount: number
  median_amount: number | null
  rank_pct: number | null
  band: 'high' | 'mid' | 'low' | null
}

/** 보여줄 게 있으면 중간값, 없으면 null */
export function peerMedian(row: PeerRow | undefined): number | null {
  if (!row || row.n < MIN_SAMPLE || row.median_amount == null) return null
  return row.median_amount
}

/** 화면에 쓸 한 줄 (없으면 null) */
export function peerLabel(row: PeerRow | undefined, format: (n: number) => string): string | null {
  const median = peerMedian(row)
  return median == null ? null : `다른 집들은 보통 ${format(median)}`
}
