import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { useLedgerStore } from './store'
import Monthly from '../pages/Monthly'
import { renderScreen, seedStore } from '../test/renderScreen'
import type { Confession } from '../types'

const between = vi.hoisted(() => vi.fn())
vi.mock('./db', async (orig) => ({
  ...(await orig<typeof import('./db')>()),
  fetchConfessionsBetween: between,
}))

const rec = (id: string, createdAt: string, amount = 10_000): Confession => ({
  id,
  memberNo: 1,
  kind: 'variable',
  category: '식비',
  amount,
  createdAt,
})

beforeEach(() => between.mockReset())

describe('62일보다 앞선 소비 기록 (2026-11-17 의견: "이전에 입력해둔 소비기록이 사라져요")', () => {
  it('앞선 기간만 서버에서 더 읽어 합치고, 같은 기간은 다시 안 읽는다', async () => {
    seedStore({ confessions: [rec('new', '2026-10-01T03:00:00Z')] })
    useLedgerStore.setState({ householdId: 'h1', confessionsFrom: '2026-09-16T00:00:00.000Z' })
    between.mockResolvedValue([
      rec('old', '2026-09-03T03:00:00Z'),
      rec('new', '2026-10-01T03:00:00Z'),
    ])

    await useLedgerStore.getState().loadOlderConfessions(new Date('2026-09-01T00:00:00Z'))
    expect(between).toHaveBeenCalledTimes(1)
    expect(between.mock.calls[0][1].toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(between.mock.calls[0][2].toISOString()).toBe('2026-09-16T00:00:00.000Z')
    expect(useLedgerStore.getState().confessions.map((c) => c.id)).toEqual(['new', 'old'])

    // 이미 읽은 기간 → 서버에 다시 안 묻는다
    await useLedgerStore.getState().loadOlderConfessions(new Date('2026-09-10T00:00:00Z'))
    expect(between).toHaveBeenCalledTimes(1)
  })

  it('읽기에 실패하면 경계를 되돌려 다음에 다시 읽는다', async () => {
    seedStore({ confessions: [] })
    useLedgerStore.setState({ householdId: 'h1', confessionsFrom: '2026-09-16T00:00:00.000Z' })
    between.mockRejectedValueOnce(new Error('offline'))
    await useLedgerStore.getState().loadOlderConfessions(new Date('2026-09-01T00:00:00Z'))
    expect(useLedgerStore.getState().confessionsFrom).toBe('2026-09-16T00:00:00.000Z')
  })

  it('가계부에서 오래된 달을 열면 그 달 기록을 읽어 와 보여 준다', async () => {
    seedStore({ ledgers: [{ ym: '2026-08', items: [], closed: false, settledMembers: [] }] })
    useLedgerStore.setState({ householdId: 'h1', confessionsFrom: '2026-09-16T00:00:00.000Z' })
    between.mockResolvedValue([rec('aug', '2026-08-20T03:00:00', 23_000)])
    renderScreen(<Monthly />)
    expect((await screen.findAllByText(/이번 달 소비 기록/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/1건/).length).toBeGreaterThan(0)
    expect(between).toHaveBeenCalled()
  })
})
