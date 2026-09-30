import { describe, expect, it } from 'vitest'
import { leaveNumbersFromLedgers } from './leaveFromLedger'
import type { BudgetItem, MonthlyLedger } from '../types'

const item = (
  group: BudgetItem['group'],
  member: 1 | 2,
  planned: number,
  actual: number,
  category = '항목',
): BudgetItem => ({
  id: `${group}-${member}-${planned}-${actual}`,
  group,
  category,
  member,
  planned,
  actual,
})

describe('육아휴직 계산기 — 내 가계부 숫자', () => {
  const aug: MonthlyLedger = {
    ym: '2026-08',
    closed: true,
    items: [
      item('income', 1, 2_700_000, 2_700_000),
      item('income', 2, 2_500_000, 2_500_000),
      item('fixed', 1, 1_000_000, 1_000_000),
      item('fixed', 2, 800_000, 800_000),
      item('variable', 2, 1_500_000, 1_600_000),
    ],
  }

  it('구성원 1은 남편, 2는 아내로 가져온다', () => {
    const n = leaveNumbersFromLedgers([aug])!
    expect(n).toMatchObject({
      ym: '2026-08',
      payHusband: 2_700_000,
      payWife: 2_500_000,
      fixed: 1_800_000,
      variable: 1_600_000,
      closed: true,
    })
  })

  it('수입이 적힌 가장 최근 달을 쓴다 — 빈 다음 달은 건너뛴다', () => {
    const empty: MonthlyLedger = { ym: '2026-10', closed: false, items: [item('fixed', 1, 0, 0)] }
    expect(leaveNumbersFromLedgers([aug, empty])!.ym).toBe('2026-08')
  })

  it('정산 전인 달은 실제가 없으면 계획으로', () => {
    const sep: MonthlyLedger = {
      ym: '2026-09',
      closed: false,
      items: [item('income', 1, 3_000_000, 0), item('income', 2, 2_000_000, 2_100_000)],
    }
    const n = leaveNumbersFromLedgers([aug, sep])!
    expect(n).toMatchObject({
      ym: '2026-09',
      payHusband: 3_000_000,
      payWife: 2_100_000,
      closed: false,
    })
  })

  it('가계부가 비어 있으면 null', () => {
    expect(leaveNumbersFromLedgers([])).toBeNull()
  })
})
