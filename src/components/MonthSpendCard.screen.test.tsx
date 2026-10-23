import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import MonthSpendCard from './MonthSpendCard'
import { renderScreen, seedStore } from '../test/renderScreen'
import { currentYm } from '../lib/format'
import type { BudgetItem, Confession } from '../types'

const now = new Date().toISOString()
const conf = (id: string, memberNo: 1 | 2, amount: number, shared = false): Confession => ({
  id,
  memberNo,
  kind: 'variable',
  category: '식비',
  amount,
  shared,
  createdAt: now,
})
const item = (member: 1 | 2, category: string, planned: number, shared = false): BudgetItem => ({
  id: `${member}-${category}`,
  group: category === '용돈' ? 'fixed' : 'variable',
  category,
  member,
  planned,
  actual: 0,
  shared,
})

describe('이번 달 쓴 돈 카드 (10/23 제보: 내 기록 총액 · 남은 생활비·용돈)', () => {
  it('내 합계와 남은 생활비·용돈이 보이고, 공동으로 바꿔 볼 수 있다', async () => {
    seedStore({
      memberNo: 2,
      confessions: [
        conf('a', 2, 30_000),
        conf('b', 2, 12_000),
        conf('c', 1, 9_000),
        conf('d', 2, 50_000, true),
      ],
      ledgers: [
        {
          ym: currentYm(),
          closed: false,
          items: [
            item(2, '용돈', 300_000),
            item(1, '식비', 100_000),
            item(1, '장보기', 600_000, true),
          ],
        },
      ],
    })
    const { user } = renderScreen(<MonthSpendCard />)
    expect(screen.getByText('42,000원')).toBeInTheDocument()
    expect(screen.getByText('258,000원 남았어요')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '공동' }))
    expect(screen.getByText('50,000원')).toBeInTheDocument()
    expect(screen.getByText('550,000원 남았어요')).toBeInTheDocument()
  })

  it('예산이 없으면 예산 넣기로 안내한다', () => {
    seedStore({ memberNo: 1, confessions: [conf('a', 1, 5_000)] })
    renderScreen(<MonthSpendCard />)
    expect(screen.getByText('5,000원')).toBeInTheDocument()
    expect(screen.getByText(/예산을 넣으면 남은 돈도 보여요/)).toBeInTheDocument()
  })
})
