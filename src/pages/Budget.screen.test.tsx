import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Budget from './Budget'
import { savedItems, seedStore, TEST_YM } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'
import type { BudgetItem, MonthlyLedger } from '../types'

const item = (
  id: string,
  group: BudgetItem['group'],
  category: string,
  member: 1 | 2,
  planned: number,
): BudgetItem => ({ id, group, category, member, planned, actual: 0 })

const ledger = (ym: string, items: BudgetItem[]): MonthlyLedger => ({
  ym,
  items,
  closed: false,
  settledMembers: [],
})

function open(ym = TEST_YM) {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[{ pathname: '/budget', state: { ym } }]}>
      <Budget />
    </MemoryRouter>,
  )
  return { user }
}

const PREV = '2026-07'

describe('예산 표', () => {
  it('지난달 예산을 채워 두고, 아직 정하지 않은 돈을 보여 준다', () => {
    seedStore({
      ledgers: [
        ledger(PREV, [
          item('a', 'income', '주수입', 1, 4_000_000),
          item('b', 'income', '주수입', 2, 3_500_000),
          item('c', 'saving', '적금', 1, 1_000_000),
        ]),
      ],
    })
    open()
    expect(screen.getByText(/지난달 예산을 채워 뒀어요/)).toBeInTheDocument()
    expect(screen.getByText('650만원')).toBeInTheDocument() // 750만 − 100만
    // 줄 순서: 월급 → 공동통장 → 저축·투자 → 고정비 → 생활비
    const labels = screen
      .getAllByRole('row')
      .map((r) => r.querySelector('td')?.textContent)
      .filter(Boolean)
    expect(labels).toEqual([
      '월급',
      '↳ 공동통장으로',
      '− 저축·투자',
      '− 고정비',
      '− 생활비',
      '= 남는 돈',
    ])
  })

  it('칸을 눌러 금액을 고치고 저장하면 그 달 예산으로 남는다', async () => {
    seedStore({ ledgers: [ledger(TEST_YM, [item('a', 'income', '주수입', 1, 4_000_000)])] })
    const { user } = open()
    await user.click(screen.getByRole('button', { name: /남편 월급/ }))
    const input = screen.getByDisplayValue('4,000,000')
    await user.clear(input)
    await user.type(input, '4200000')
    await user.click(screen.getByRole('button', { name: '예산으로 저장' }))
    expect(savedItems().find((i) => i.id === 'a')!.planned).toBe(4_200_000)
  })

  it('항목을 공동으로 옮기고, 남는 돈을 저축으로 보내면 0원이 된다', async () => {
    seedStore({
      ledgers: [
        ledger(TEST_YM, [
          item('a', 'income', '주수입', 1, 3_000_000),
          item('b', 'income', '주수입', 2, 2_000_000),
          item('f', 'fixed', '주거', 1, 1_000_000),
        ]),
      ],
    })
    const { user } = open()
    await user.click(screen.getByRole('button', { name: /남편 고정비/ }))
    await user.click(screen.getByRole('button', { name: '주거 누구 돈인지 바꾸기' }))
    // 공동통장으로 — 나갈 돈 100만을 월급 비율로 (60만 · 40만)
    await user.click(screen.getByRole('button', { name: /남편 공동통장/ }))
    await user.click(screen.getByRole('button', { name: '월급 비율로' }))
    for (const b of screen.getAllByRole('button', { name: '저축으로' })) await user.click(b)
    expect(screen.queryAllByRole('button', { name: '저축으로' })).toHaveLength(0)
    expect(screen.getByText('0원 · 다 정했어요')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '예산으로 저장' }))
    const saved = useLedgerStore.getState().ledgers.find((l) => l.ym === TEST_YM)!
    expect(saved.contributions).toEqual({ 1: 600_000, 2: 400_000 })
    expect(saved.items.find((i) => i.id === 'f')!.shared).toBe(true)
    const savings = saved.items.filter((i) => i.group === 'saving')
    expect(savings.reduce((a, i) => a + i.planned, 0)).toBe(5_000_000 - 1_000_000)
  })

  it('빈 칸은 카테고리를 골라 항목을 만든다', async () => {
    seedStore({ ledgers: [ledger(TEST_YM, [item('a', 'income', '주수입', 2, 3_000_000)])] })
    const { user } = open()
    await user.click(screen.getByRole('button', { name: /공동 생활비/ }))
    await user.click(screen.getByRole('button', { name: '+ 식비' }))
    const inputs = screen.getAllByRole('textbox')
    await user.type(inputs[inputs.length - 1], '800000')
    await user.click(screen.getByRole('button', { name: '예산으로 저장' }))
    const food = savedItems().find((i) => i.category === '식비')!
    expect(food).toMatchObject({ group: 'variable', shared: true, planned: 800_000 })
  })
})
