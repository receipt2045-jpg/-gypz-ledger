import { describe, expect, it } from 'vitest'
import { catchUpSaving, nextSavingDate, savingAtEnd, type SavingPlan } from './saving'
import type { AssetItem } from '../types'

const item = (saving: SavingPlan, amount = 1_000_000): AssetItem => ({
  id: 'a1',
  kind: 'asset',
  group: 'cash',
  name: '청년도약계좌',
  amount,
  saving,
})

describe('적금 자동 저축 (2026-11-24 의견)', () => {
  it('넣는 날이 지날 때마다 매달 넣는 돈을 더한다', () => {
    const next = catchUpSaving(
      item({ monthly: 300_000, day: 25, asOf: '2026-09-30' }),
      new Date(2026, 10, 25), // 10/25, 11/25 두 번
    )
    expect(next?.amount).toBe(1_600_000)
    expect(next?.saving?.asOf).toBe('2026-11-25')
  })

  it('넣는 날 전이면 그대로 (null)', () => {
    expect(
      catchUpSaving(
        item({ monthly: 300_000, day: 25, asOf: '2026-11-01' }),
        new Date(2026, 10, 24),
      ),
    ).toBeNull()
  })

  it('31일로 정하면 짧은 달엔 말일에 넣는다', () => {
    const next = catchUpSaving(
      item({ monthly: 100_000, day: 31, asOf: '2026-11-01' }),
      new Date(2026, 10, 30),
    )
    expect(next?.amount).toBe(1_100_000)
    expect(next?.saving?.asOf).toBe('2026-11-30')
  })

  it('만기 달이 지나면 더 넣지 않는다', () => {
    const next = catchUpSaving(
      item({ monthly: 500_000, day: 10, asOf: '2026-08-15', endYm: '2026-10' }),
      new Date(2026, 11, 20), // 9/10, 10/10만 — 11·12월은 만기 뒤
    )
    expect(next?.amount).toBe(2_000_000)
    expect(catchUpSaving(next!, new Date(2027, 2, 1))).toBeNull()
  })

  it('부채나 자동 저축이 없는 항목은 건드리지 않는다', () => {
    const plain: AssetItem = { id: 'b', kind: 'asset', group: 'cash', name: '통장', amount: 5 }
    expect(catchUpSaving(plain, new Date())).toBeNull()
    expect(
      catchUpSaving(
        { ...item({ monthly: 1, day: 1, asOf: '2020-01-01' }), kind: 'debt' },
        new Date(),
      ),
    ).toBeNull()
  })

  it('다음 넣는 날과 만기 때 잔액(이자 빼고)', () => {
    const plan: SavingPlan = { monthly: 200_000, day: 15, asOf: '2026-11-24', endYm: '2027-02' }
    const today = new Date(2026, 10, 24)
    expect(nextSavingDate(plan, today)?.getDate()).toBe(15)
    expect(nextSavingDate(plan, today)?.getMonth()).toBe(11)
    // 12/15, 1/15, 2/15 세 번
    expect(savingAtEnd(1_000_000, plan, today)).toBe(1_600_000)
    expect(nextSavingDate({ ...plan, endYm: '2026-10' }, today)).toBeNull()
  })
})
