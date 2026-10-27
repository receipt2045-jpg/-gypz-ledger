import { describe, expect, it } from 'vitest'
import {
  addMonths,
  dueMonths,
  isRecurringRecord,
  lastDueYm,
  nextPay,
  recurringAmount,
  recurringId,
  type ChildRecurring,
} from './childRecurring'

const rule = (p: Partial<ChildRecurring> = {}): ChildRecurring => ({
  id: 'r1',
  child: '찰떡이',
  kind: 'allowance',
  label: '아동수당',
  amount: 100_000,
  day: 25,
  startYm: '2025-11',
  childKeep: true,
  gift: false,
  ...p,
})

describe('아이 앞으로 매달 들어오는 돈 (2026-10-27)', () => {
  it('들어오는 날이 지나야 그달이 찬다', () => {
    expect(lastDueYm(25, new Date('2026-10-24T12:00:00'))).toBe('2026-09')
    expect(lastDueYm(25, new Date('2026-10-25T12:00:00'))).toBe('2026-10')
    // 31일로 정해도 2월은 말일에
    expect(lastDueYm(31, new Date('2026-02-28T12:00:00'))).toBe('2026-02')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
  })

  it('1년치 한 번에 — 시작 달부터 이번 달까지, 뺀 달은 표시만', () => {
    const due = dueMonths(rule({ skip: ['2026-04'] }), undefined, new Date('2026-10-27T12:00:00'))
    expect(due).toHaveLength(12)
    expect(due[0]).toEqual({ ym: '2025-11', amount: 100_000, skipped: false })
    expect(due.find((d) => d.ym === '2026-04')?.skipped).toBe(true)
  })

  it('이미 적은 달 다음부터만, 멈춘 달 뒤로는 안 적는다', () => {
    const now = new Date('2026-12-26T12:00:00')
    expect(dueMonths(rule({ doneYm: '2026-10' }), undefined, now).map((d) => d.ym)).toEqual([
      '2026-11',
      '2026-12',
    ])
    expect(dueMonths(rule({ doneYm: '2026-10', stoppedYm: '2026-10' }), undefined, now)).toEqual([])
  })

  it('부모급여 — 생일을 알면 돌 지나 50만, 두 돌에 끝', () => {
    const r = rule({ kind: 'parentPay', label: '부모급여', amount: 1_000_000 })
    expect(recurringAmount(r, '2026-02', '2025-03-10')).toBe(1_000_000)
    expect(recurringAmount(r, '2026-03', '2025-03-10')).toBe(500_000)
    expect(recurringAmount(r, '2027-03', '2025-03-10')).toBe(0)
    // 어린이집(돌 지나 현금 0)
    expect(recurringAmount({ ...r, amountAfter1: 0 }, '2026-03', '2025-03-10')).toBe(0)
    // 생일을 모르면 늘 같은 금액
    expect(recurringAmount(r, '2030-01')).toBe(1_000_000)
    expect(nextPay(r, '2025-03-10', new Date('2027-03-26T12:00:00'))).toBeNull()
  })

  it('아동수당 — 13세 생일 전달까지', () => {
    expect(recurringAmount(rule(), '2039-02', '2026-03-10')).toBe(100_000)
    expect(recurringAmount(rule(), '2039-03', '2026-03-10')).toBe(0)
  })

  it('기록 id는 (규칙, 달)마다 늘 같고 uuid 모양', () => {
    const id = recurringId('r1', '2026-10')
    expect(id).toBe(recurringId('r1', '2026-10'))
    expect(id).not.toBe(recurringId('r1', '2026-11'))
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(isRecurringRecord(id, new Date(2026, 9, 25, 12).toISOString(), [rule()])).toBe(true)
  })
})
