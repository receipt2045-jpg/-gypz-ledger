/**
 * 또래 비교 — 모아불리를 쓰는 부부들 사이에서 우리집 고정비 위치.
 *
 * 숫자는 서버(fixed_cost_benchmark RPC)가 분포만 계산해서 준다.
 * 여기서는 '표본이 얼마나 모였는지'에 따라 무엇까지 말할지를 정한다.
 * 20집짜리 표본으로 "상위 12%"라고 하면 그건 통계가 아니라 꾸며낸 정밀도다.
 */

/** 표본이 이만큼 모여야 비교를 시작한다 */
export const MIN_SAMPLE = 20
/** 정확한 백분위를 말해도 되는 표본 */
export const EXACT_SAMPLE = 50

export interface PeerRow {
  category: string
  n: number
  my_amount: number
  median_amount: number | null
  rank_pct: number | null
  band: 'high' | 'mid' | 'low' | null
}

export type PeerState =
  | { kind: 'locked'; need: number } // 표본 부족 — 몇 집 더 모이면 열리는지
  | { kind: 'band'; band: 'high' | 'mid' | 'low'; n: number; median: number }
  | { kind: 'exact'; rankPct: number; n: number; median: number }

export function peerStateOf(row: PeerRow): PeerState {
  if (row.n < MIN_SAMPLE || row.median_amount == null) {
    return { kind: 'locked', need: Math.max(1, MIN_SAMPLE - row.n) }
  }
  if (row.n >= EXACT_SAMPLE && row.rank_pct != null) {
    return { kind: 'exact', rankPct: row.rank_pct, n: row.n, median: row.median_amount }
  }
  // band는 20집 이상이면 서버가 항상 채워주지만, 없으면 '보통'으로 둔다
  return { kind: 'band', band: row.band ?? 'mid', n: row.n, median: row.median_amount }
}

/** 화면에 쓸 한 줄 */
export function peerLabel(s: PeerState): string {
  switch (s.kind) {
    case 'locked':
      return `${s.need}집 더 모이면 비교할 수 있어요`
    case 'band':
      return s.band === 'high'
        ? `${s.n}집 중 많이 쓰는 편`
        : s.band === 'low'
          ? `${s.n}집 중 적게 쓰는 편`
          : `${s.n}집 중 보통`
    case 'exact':
      return `${s.n}집 중 상위 ${s.rankPct}%`
  }
}

/** 강조 색을 쓸지 (많이 쓰는 편일 때만) */
export function peerIsHigh(s: PeerState): boolean {
  return (s.kind === 'band' && s.band === 'high') || (s.kind === 'exact' && s.rankPct <= 25)
}
