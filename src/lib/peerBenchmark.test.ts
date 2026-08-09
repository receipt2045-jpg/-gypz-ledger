import { describe, expect, it } from 'vitest'
import { peerLabel, peerMedian, type PeerRow } from './peerBenchmark'
import { formatWon } from './format'

const row = (over: Partial<PeerRow>): PeerRow => ({
  category: '보험',
  n: 30,
  my_amount: 700_000,
  median_amount: 380_000,
  rank_pct: 12,
  band: 'high',
  ...over,
})

describe('peerMedian — 말할 자격이 있을 때만 말한다', () => {
  it('표본이 충분하면 중간값을 준다', () => {
    expect(peerMedian(row({ n: 30 }))).toBe(380_000)
  })

  // 다섯 집의 중간값은 통계가 아니다
  it('표본이 적으면 아무것도 주지 않는다', () => {
    expect(peerMedian(row({ n: 14 }))).toBeNull()
  })

  it('서버가 중간값을 가렸으면 주지 않는다', () => {
    expect(peerMedian(row({ n: 40, median_amount: null }))).toBeNull()
  })

  it('데이터 자체가 없으면 null', () => {
    expect(peerMedian(undefined)).toBeNull()
  })
})

describe('peerLabel — 순위도 표본 수도 드러내지 않는다', () => {
  it('중간값만 조용히 알려준다', () => {
    expect(peerLabel(row({}), formatWon)).toBe('다른 집들은 보통 380,000원')
  })

  // "30집 중"은 표본이 작다는 걸 광고하는 꼴이고, "상위 12%"는 위축시킨다
  it('표본 수와 순위 표현이 들어가지 않는다', () => {
    const label = peerLabel(row({ n: 128, rank_pct: 12 }), formatWon)!
    expect(label).not.toMatch(/집 중|상위|하위|%/)
  })

  it('보여줄 게 없으면 null이라 화면에서 아예 빠진다', () => {
    expect(peerLabel(row({ n: 3 }), formatWon)).toBeNull()
  })
})
