import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const fetchPeerBenchmark = vi.fn()
vi.mock('../lib/db', () => ({
  fetchPeerBenchmark: () => fetchPeerBenchmark(),
}))

import FixedCostCheck from './FixedCostCheck'
import { useLedgerStore } from '../lib/store'
import type { BudgetItem } from '../types'

const item = (group: BudgetItem['group'], category: string, amount: number): BudgetItem => ({
  id: `${group}-${category}`,
  group,
  category,
  member: 1,
  planned: amount,
  actual: amount,
})

const items = [item('income', '주수입', 5_000_000), item('fixed', '보험', 700_000)]

describe('고정비 점검 — 또래 기준값', () => {
  beforeEach(() => {
    fetchPeerBenchmark.mockReset()
    useLedgerStore.setState({ householdId: 'hh-1' })
  })

  it('표본이 충분하면 중간값만 조용히 보여준다', async () => {
    fetchPeerBenchmark.mockResolvedValue([
      { category: '보험', n: 128, my_amount: 700_000, median_amount: 380_000, rank_pct: 12, band: 'high' },
    ])
    render(<FixedCostCheck items={items} closed />)

    await waitFor(() => expect(screen.getByText(/다른 집들은 보통 380,000원/)).toBeInTheDocument())
  })

  // 순위는 위축시키고, 표본 수는 초라해 보인다 — 둘 다 안 쓰기로 한 결정
  it('순위도 표본 수도 화면에 나오지 않는다', async () => {
    fetchPeerBenchmark.mockResolvedValue([
      { category: '보험', n: 128, my_amount: 700_000, median_amount: 380_000, rank_pct: 12, band: 'high' },
    ])
    render(<FixedCostCheck items={items} closed />)

    await waitFor(() => expect(screen.getByText(/다른 집들은 보통/)).toBeInTheDocument())
    expect(screen.queryByText(/상위/)).not.toBeInTheDocument()
    expect(screen.queryByText(/집 중/)).not.toBeInTheDocument()
    expect(screen.queryByText(/128/)).not.toBeInTheDocument()
  })

  it('표본이 적으면 줄 자체가 안 나온다', async () => {
    fetchPeerBenchmark.mockResolvedValue([
      { category: '보험', n: 14, my_amount: 700_000, median_amount: null, rank_pct: null, band: null },
    ])
    render(<FixedCostCheck items={items} closed />)

    await waitFor(() => expect(fetchPeerBenchmark).toHaveBeenCalled())
    expect(screen.queryByText(/다른 집들은/)).not.toBeInTheDocument()
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
