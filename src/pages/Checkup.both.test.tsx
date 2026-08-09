import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import Checkup from './Checkup'
import { renderScreen, savedItems, seedStore, TEST_YM } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'
import type { BudgetItem, MonthlyLedger } from '../types'

const item = (
  id: string,
  group: BudgetItem['group'],
  category: string,
  member: 1 | 2,
  amount: number,
): BudgetItem => ({ id, group, category, member, planned: amount, actual: amount })

const ledger = (items: BudgetItem[]): MonthlyLedger => ({
  ym: TEST_YM,
  items,
  closed: false,
  settledMembers: [],
})

/** 부부 항목이 모두 들어 있는 한 달 */
const bothItems = [
  item('h-inc', 'income', '주수입', 1, 4_000_000),
  item('w-inc', 'income', '주수입', 2, 3_000_000),
  item('h-fix', 'fixed', '보험', 1, 300_000),
  item('w-var', 'variable', '식비', 2, 500_000),
]

function openCheckup(items = bothItems) {
  seedStore({ ledgers: [ledger(items)] })
  return renderScreen(<Checkup />)
}

const settled = () =>
  useLedgerStore.getState().ledgers.find((l) => l.ym === TEST_YM)?.settledMembers ?? []
const isClosed = () =>
  useLedgerStore.getState().ledgers.find((l) => l.ym === TEST_YM)?.closed ?? false

describe('정산 — 혼자서도 완주하기', () => {
  it('구성원 선택 화면에 "둘 다 제가 입력할게요"가 있다', () => {
    openCheckup()
    expect(screen.getByRole('button', { name: /둘 다 제가 입력할게요/ })).toBeInTheDocument()
  })

  // 실측: 혼자 남은 가구가 70%였고, 한 명만 정산하면 결산이 영원히 미완성이었다
  it('둘 다 입력을 고르면 배우자 항목까지 화면에 나온다', async () => {
    const { user } = openCheckup()
    await user.click(screen.getByRole('button', { name: /둘 다 제가 입력할게요/ }))

    // 수입 스텝 — 남편·아내 주수입이 둘 다 보여야 한다
    expect(screen.getAllByLabelText('삭제')).toHaveLength(2)
  })

  it('한 사람만 고르면 자기 항목만 나온다 (기존 동작 유지)', async () => {
    const { user } = openCheckup()
    await user.click(screen.getByRole('button', { name: /아내/ }))

    expect(screen.getAllByLabelText('삭제')).toHaveLength(1)
  })

  it('둘 다 입력으로 끝내면 결산이 확정된다', async () => {
    const { user } = openCheckup()
    await user.click(screen.getByRole('button', { name: /둘 다 제가 입력할게요/ }))

    // 수입 → 저축·투자 → 고정지출 → 변동지출 → 완료
    await user.click(screen.getByRole('button', { name: '다음' })) // 수입
    await user.click(screen.getByRole('button', { name: '다음' })) // 저축·투자(빈 스텝)
    await user.click(screen.getByRole('button', { name: '다음' })) // 고정지출
    await user.click(screen.getByRole('button', { name: /정산 완료하기/ }))

    expect(settled().sort()).toEqual([1, 2])
    expect(isClosed()).toBe(true)
    expect(screen.getByText(/정산 완료 🎉/)).toBeInTheDocument()
  })

  it('둘 다 입력이어도 두 사람 항목이 그대로 저장된다', async () => {
    const { user } = openCheckup()
    await user.click(screen.getByRole('button', { name: /둘 다 제가 입력할게요/ }))
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: /정산 완료하기/ }))

    expect(savedItems()).toHaveLength(4)
    expect(savedItems().filter((i) => i.member === 1)).toHaveLength(2)
    expect(savedItems().filter((i) => i.member === 2)).toHaveLength(2)
  })

  it('한 사람만 정산하면 예전처럼 그 사람만 완료로 남는다', async () => {
    const { user } = openCheckup()
    await user.click(screen.getByRole('button', { name: /아내/ }))
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: /정산 완료하기/ }))

    expect(settled()).toEqual([2])
    expect(isClosed()).toBe(false)
  })
})
