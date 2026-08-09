import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const fetchPeerBenchmark = vi.fn()
vi.mock('../lib/db', () => ({
  fetchPeerBenchmark: () => fetchPeerBenchmark(),
}))

import FixedCostCheck from './FixedCostCheck'
import { useLedgerStore } from '../lib/store'
import type { BudgetItem } from '../types'

const item = (
  group: BudgetItem['group'],
  category: string,
  amount: number,
): BudgetItem => ({
  id: `${group}-${category}`,
  group,
  category,
  member: 1,
  planned: amount,
  actual: amount,
})

const items = [item('income', '주수입', 5_000_000), item('fixed', '보험', 700_000)]

describe('고정비 점검 — 또래 비교', () => {
  beforeEach(() => {
    fetchPeerBenchmark.mockReset()
    useLedgerStore.setState({ householdId: 'hh-1' })
  })

  it('표본이 충분하면 위치를 보여준다', async () => {
    fetchPeerBenchmark.mockResolvedValue([
      { category: '보험', n: 128, my_amount: 700_000, median_amount: 380_000, rank_pct: 12, band: 'high' },
    ])
    render(<FixedCostCheck items={items} closed />)

    await waitFor(() => expect(screen.getByText(/128집 중 상위 12%/)).toBeInTheDocument())
    expect(screen.getByText(/중간값 380,000원/)).toBeInTheDocument()
  })

  it('표본이 어중간하면 순위 대신 3단계로만 말한다', async () => {
    fetchPeerBenchmark.mockResolvedValue([
      { category: '보험', n: 30, my_amount: 700_000, median_amount: 380_000, rank_pct: null, band: 'high' },
    ])
    render(<FixedCostCheck items={items} closed />)

    await waitFor(() => expect(screen.getByText(/30집 중 많이 쓰는 편/)).toBeInTheDocument())
    expect(screen.queryByText(/상위/)).not.toBeInTheDocument()
  })

  // 표본이 적을 때 순위를 말하면 거짓말이 된다 — 잠그고 얼마나 남았는지만 알린다
  it('표본이 적으면 잠그고 몇 집 더 필요한지 알려준다', async () => {
    fetchPeerBenchmark.mockResolvedValue([
      { category: '보험', n: 14, my_amount: 700_000, median_amount: null, rank_pct: null, band: null },
    ])
    render(<FixedCostCheck items={items} closed />)

    await waitFor(() => expect(screen.getByText(/6집 더 모이면/)).toBeInTheDocument())
    expect(screen.queryByText(/중간값/)).not.toBeInTheDocument()
  })

  it('로그인 전이면 서버에 묻지 않는다', async () => {
    useLedgerStore.setState({ householdId: null })
    render(<FixedCostCheck items={items} closed />)
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchPeerBenchmark).not.toHaveBeenCalled()
  })

  it('비교를 못 불러와도 카드는 그대로 나온다', async () => {
    fetchPeerBenchmark.mockRejectedValue(new Error('offline'))
    render(<FixedCostCheck items={items} closed />)

    await waitFor(() => expect(fetchPeerBenchmark).toHaveBeenCalled())
    expect(screen.getByText('고정비 점검')).toBeInTheDocument()
    expect(screen.getByText('보험')).toBeInTheDocument()
  })
})
