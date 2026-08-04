import { describe, expect, it } from 'vitest'
import { buildMonthlyCard, headlineOf } from './monthlyCard'
import type { AssetSnapshot, BudgetItem, MonthlyLedger, Profile } from '../types'

const profile: Profile = {
  member1Name: '남편',
  member2Name: '아내',
  childNames: [],
  targetNetWorth: 1_000_000_000,
  startYear: 2026,
}

const item = (
  group: BudgetItem['group'],
  member: 1 | 2,
  amount: number,
): BudgetItem => ({
  id: `${group}-${member}-${amount}`,
  group,
  category: '테스트',
  member,
  planned: amount,
  actual: amount,
})

describe('headlineOf — 한 줄 평', () => {
  it('잉여현금이 마이너스면 저축률이 높아도 축하하지 않는다', () => {
    // 빚내서 저축한 셈이라 "잘했다"고 하면 안 된다
    expect(headlineOf(0.6, -500_000)).toContain('쓴 게 많았어요')
  })

  it('저축률 구간마다 다른 말이 나온다', () => {
    expect(headlineOf(0.55, 100)).toContain('절반을 넘겼어요')
    expect(headlineOf(0.42, 100)).toContain('42%')
    expect(headlineOf(0.05, 100)).toContain('적었어요')
  })

  it('퍼센트는 반올림해서 보여준다', () => {
    expect(headlineOf(0.426, 100)).toContain('43%')
  })
})

describe('buildMonthlyCard — 성적표 데이터', () => {
  const ledger: MonthlyLedger = {
    ym: '2026-08',
    closed: true,
    settledMembers: [1, 2],
    items: [
      item('income', 1, 4_000_000),
      item('income', 2, 3_000_000),
      item('saving', 1, 1_000_000),
      item('investment', 2, 800_000),
      item('variable', 2, 1_200_000),
    ],
  }
  const snapshots: AssetSnapshot[] = [
    { ym: '2026-07', items: [{ id: 'a', kind: 'asset', group: 'cash', name: '통장', amount: 50_000_000 }] },
    { ym: '2026-08', items: [{ id: 'a', kind: 'asset', group: 'cash', name: '통장', amount: 55_000_000 }] },
  ]

  it('구성원별 저축·투자 기여를 나눠서 담는다', () => {
    const d = buildMonthlyCard(ledger, snapshots, profile)
    expect(d.memberSaving).toEqual([1_000_000, 800_000])
    expect(d.memberNames).toEqual(['남편', '아내'])
  })

  it('순자산과 전월 대비 증감을 계산한다', () => {
    const d = buildMonthlyCard(ledger, snapshots, profile)
    expect(d.netWorth).toBe(55_000_000)
    expect(d.netWorthDelta).toBe(5_000_000)
  })

  it('저축·투자율은 수입 대비 저축+투자', () => {
    const d = buildMonthlyCard(ledger, snapshots, profile)
    // (100만 + 80만) / 700만
    expect(Math.round(d.savingInvestRate * 100)).toBe(26)
    expect(d.savingInvest).toBe(1_800_000)
  })

  it('직전 달 스냅샷이 없으면 증감은 현재 순자산 그대로', () => {
    const d = buildMonthlyCard(ledger, [snapshots[1]], profile)
    expect(d.netWorthDelta).toBe(55_000_000)
  })
})
