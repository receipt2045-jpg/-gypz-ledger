import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import Checkup from './Checkup'
import { renderScreen, savedItems, seedStore, TEST_YM } from '../test/renderScreen'
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

/** 정산 화면을 띄우고 '아내'를 골라 수입 스텝까지 간다 */
async function openAsWife(items: BudgetItem[]) {
  seedStore({ ledgers: [ledger(items)] })
  const { user } = renderScreen(<Checkup />)
  await user.click(screen.getByRole('button', { name: /아내/ }))
  return { user }
}

/** 화면에 보이는 항목 행들 (카테고리 이름 기준) */
function visibleRows() {
  return screen
    .getAllByLabelText('삭제')
    .map((btn) => btn.closest('div.rounded-card')?.querySelector('p')?.textContent)
}

describe('정산 화면 — 항목 삭제', () => {
  // 제보 재현: "'부수입' 항목이 X표 눌러도 안 없어져요"
  // 예전에는 마지막 스텝까지 가서 '정산 완료하기'를 눌러야만 저장돼서,
  // 수입 스텝에서 지우고 나가면 지운 게 없던 일이 됐다.
  it('X를 누르면 정산을 끝내지 않아도 바로 저장된다', async () => {
    const { user } = await openAsWife([
      item('a', 'income', '주수입', 2, 3_000_000),
      item('b', 'income', '부수입', 2, 200_000),
    ])

    expect(savedItems().map((i) => i.category)).toContain('부수입')

    const rows = screen.getAllByLabelText('삭제')
    await user.click(rows[1]) // 부수입 행의 X

    // 다음 스텝으로 넘어가지도, 완료 버튼을 누르지도 않았다
    expect(savedItems().map((i) => i.category)).not.toContain('부수입')
  })

  // 같은 카테고리를 두 개 쓰는 가구(부수입 20만 + 5만)에서 이월 ID가 겹쳤다.
  // 그러면 한 번의 X로 두 행이 같이 지워진다.
  it('같은 카테고리가 둘일 때 X 한 번에 한 행만 지워진다', async () => {
    const { user } = await openAsWife([
      item('a', 'income', '주수입', 2, 3_000_000),
      item('b', 'income', '부수입', 2, 200_000),
      item('c', 'income', '부수입', 2, 50_000),
    ])

    await user.click(screen.getAllByLabelText('삭제')[1])

    const left = savedItems().filter((i) => i.category === '부수입')
    expect(left).toHaveLength(1)
    expect(left[0].planned).toBe(50_000)
  })

  it('배우자 항목은 내가 지워도 살아남는다', async () => {
    const { user } = await openAsWife([
      item('h', 'income', '주수입', 1, 4_000_000),
      item('w', 'income', '부수입', 2, 200_000),
    ])

    await user.click(screen.getAllByLabelText('삭제')[0]) // 화면엔 내 항목만 보인다

    expect(savedItems().filter((i) => i.member === 1)).toHaveLength(1)
    expect(savedItems().filter((i) => i.member === 2)).toHaveLength(0)
  })

  it('내 항목만 화면에 보인다', async () => {
    await openAsWife([
      item('h', 'income', '주수입', 1, 4_000_000),
      item('w', 'income', '부수입', 2, 200_000),
    ])
    expect(visibleRows()).toEqual(['부수입'])
  })
})

describe('정산 화면 — 스텝 이동', () => {
  // 예전에는 네 스텝이 같은 컴포넌트를 재사용해서, 수입 스텝에서 '항목 추가'를
  // 열어둔 채 넘어가면 저축·투자 화면인데 카테고리 목록이 수입 것으로 남았다.
  // 거기서 추가하면 그 화면엔 보이지도 않는 수입 항목이 생겼다.
  it('스텝을 넘어가면 항목 추가 폼이 초기화된다', async () => {
    const { user } = await openAsWife([item('a', 'income', '주수입', 2, 3_000_000)])

    await user.click(screen.getByRole('button', { name: /항목 추가/ }))
    expect(screen.getByRole('option', { name: '부수입' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '다음' }))

    expect(screen.getByText('저축·투자')).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '부수입' })).not.toBeInTheDocument()
  })

  it('저축·투자 스텝의 항목 추가는 저축 카테고리를 보여준다', async () => {
    const { user } = await openAsWife([item('a', 'income', '주수입', 2, 3_000_000)])
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: /항목 추가/ }))

    expect(screen.getByRole('option', { name: '주택청약' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '주수입' })).not.toBeInTheDocument()
  })

  // 0원 항목이 있으면 다음으로 못 넘어간다. 이게 없으면 안 쓴 항목이 그대로 결산에 남는다.
  it('금액이 0원인 항목이 있으면 다음으로 못 넘어간다', async () => {
    const { user } = await openAsWife([item('a', 'income', '주수입', 2, 0)])

    await user.click(screen.getByRole('button', { name: '다음' }))

    expect(screen.getByText(/금액을 입력해 주세요/)).toBeInTheDocument()
    expect(screen.getByText('수입')).toBeInTheDocument() // 여전히 수입 스텝
  })
})
