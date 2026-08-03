import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import AssetDonut from './AssetDonut'

describe('자산 도넛 — 순자산 표기', () => {
  // 제보 재현: 순자산 -4천만원이 범례에서 "4,000만원"으로 보였다
  // (부채용 절댓값 표기를 순자산도 같이 타서 부호가 사라짐)
  it('부채가 자산보다 많으면 가운데와 범례 모두 -가 보인다', () => {
    render(<AssetDonut assets={10_000_000} debts={50_000_000} />)
    // 가운데 숫자 + 범례 순자산, 두 곳 다
    expect(screen.getAllByText('-4,000만원')).toHaveLength(2)
    expect(screen.queryByText('4,000만원')).not.toBeInTheDocument()
  })

  it('순자산이 양수면 그대로, 부채는 −를 붙여 보여준다', () => {
    render(<AssetDonut assets={50_000_000} debts={10_000_000} />)
    expect(screen.getAllByText('4,000만원').length).toBeGreaterThan(0) // 순자산
    expect(screen.getByText('−1,000만원')).toBeInTheDocument() // 부채
  })
})
