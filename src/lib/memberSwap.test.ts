import { describe, expect, it } from 'vitest'
import { useLedgerStore } from './store'
import { seedStore } from '../test/renderScreen'
import type { BudgetItem } from '../types'

const item = (id: string, member: 1 | 2, category: string): BudgetItem => ({
  id,
  group: 'income',
  category,
  member,
  planned: 1,
  actual: 1,
})

// 제보 재현: 아내(시내)가 먼저 만들어 구성원 1인데, 구성원 1 이름을 '현수'로 적었다.
// (나)가 현수에 붙고, 이름 바꾸기를 누르면 이름만 바뀌고 기록은 그대로였다.
describe('자리 바꾸기 — 기록이 이름을 따라간다', () => {
  it('이름·색과 함께 예산 항목·정산 마친 사람·공동통장·소비 기록 번호가 맞바뀐다', async () => {
    seedStore({
      memberNo: 1,
      ledgers: [
        {
          ym: '2026-10',
          items: [item('a', 1, '현수 월급'), item('b', 2, '시내 월급')],
          closed: false,
          settledMembers: [1],
          contributions: { 1: 100, 2: 200 },
        },
      ],
      confessions: [
        {
          id: 'c',
          memberNo: 1,
          cardOwner: 2,
          category: '식비',
          kind: 'variable',
          amount: 1000,
          createdAt: '2026-10-07T00:00:00Z',
        },
      ],
    })
    useLedgerStore.setState((s) => ({
      profile: { ...s.profile, member1Name: '현수', member2Name: '시내', member1Color: 'purple' },
    }))

    await useLedgerStore.getState().swapMembers()
    const s = useLedgerStore.getState()

    expect(s.memberNo).toBe(1) // 계정 번호는 그대로 → (나)는 이제 시내
    expect([s.profile.member1Name, s.profile.member2Name]).toEqual(['시내', '현수'])
    expect(s.profile.member2Color).toBe('purple')
    const l = s.ledgers[0]
    const nameOf = (m: 1 | 2) => (m === 1 ? s.profile.member1Name : s.profile.member2Name)
    // '현수 월급'은 여전히 현수 것
    expect(l.items.map((it) => `${it.category}:${nameOf(it.member)}`)).toEqual([
      '현수 월급:현수',
      '시내 월급:시내',
    ])
    expect(l.settledMembers).toEqual([2])
    expect(l.contributions).toEqual({ 1: 200, 2: 100 })
    expect(s.confessions[0]).toMatchObject({ memberNo: 2, cardOwner: 1 })
  })
})
