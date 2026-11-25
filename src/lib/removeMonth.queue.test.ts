import { describe, expect, it, vi } from 'vitest'
import { useLedgerStore } from './store'
import { QUEUE_KEY, enqueue, pendingCount } from './syncQueue'
import type { MonthlyLedger } from '../types'

vi.mock('./db', async (orig) => ({
  ...(await orig<typeof import('./db')>()),
  deleteMonth: vi.fn().mockResolvedValue(undefined),
}))

describe('달 통째로 지우기 (2026-11-19 점검)', () => {
  it('못 보낸 그 달 저장분을 버려서, 다시 연결돼도 지운 달이 되살아나지 않는다', () => {
    localStorage.removeItem(QUEUE_KEY)
    const nov: MonthlyLedger = { ym: '2026-11', items: [], closed: false }
    enqueue({ kind: 'ledger', key: 'ledger:2026-11', payload: nov })
    enqueue({ kind: 'ledger', key: 'ledger:2026-10', payload: { ...nov, ym: '2026-10' } })
    useLedgerStore.setState({ householdId: 'h1', ledgers: [nov], snapshots: [] })

    useLedgerStore.getState().removeMonth('2026-11')

    expect(pendingCount()).toBe(1) // 10월 것만 남는다
    expect(JSON.parse(localStorage.getItem(QUEUE_KEY)!)[0].key).toBe('ledger:2026-10')
  })
})
