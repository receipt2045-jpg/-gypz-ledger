import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import Monthly from './Monthly'
import Yearly from './Yearly'
import { renderScreen, seedStore, TEST_YM } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'

const savedOccasions = () => useLedgerStore.getState().occasions

function seedWithLedger() {
  seedStore({
    ledgers: [
      {
        ym: TEST_YM,
        closed: false,
        settledMembers: [],
        items: [
          { id: 'a', group: 'income', category: '주수입', member: 2, planned: 3_000_000, actual: 0 },
        ],
      },
    ],
  })
}

describe('가계부 탭 — 비정기 지출 기록', () => {
  it('가계부 탭에서 비정기 지출을 바로 추가할 수 있다', async () => {
    seedWithLedger()
    const { user } = renderScreen(<Monthly />)

    await user.click(screen.getByRole('button', { name: /추가/ }))
    await user.type(screen.getByPlaceholderText(/내용/), '친구 결혼식')
    await user.type(screen.getByPlaceholderText('금액'), '100000')
    await user.click(screen.getByRole('button', { name: '추가하기' }))

    expect(savedOccasions()).toHaveLength(1)
    expect(savedOccasions()[0]).toMatchObject({ title: '친구 결혼식', amount: 100_000 })
  })

  it('보는 달의 비정기 지출만 목록에 보인다', () => {
    seedWithLedger()
    useLedgerStore.setState({
      occasions: [
        { id: 'o1', date: `${TEST_YM}-10`, category: '가족경조사', title: '어머니 생신', amount: 200_000 },
        { id: 'o2', date: '2026-03-05', category: '세금', title: '자동차세', amount: 150_000 },
      ],
    })
    renderScreen(<Monthly />)

    expect(screen.getByText('어머니 생신')).toBeInTheDocument()
    expect(screen.queryByText('자동차세')).not.toBeInTheDocument()
  })
})

describe('연간 리포트 — 조회 전용 + 연말정산 입구', () => {
  it('연간 리포트엔 비정기 지출 추가 버튼이 없다 (기록은 가계부 탭)', () => {
    seedStore({})
    renderScreen(<Yearly />)
    expect(screen.getByText('비정기 지출')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /추가/ })).not.toBeInTheDocument()
  })

  it('연말정산 미리보기 입구가 연간 리포트 상단에 있다', () => {
    seedStore({})
    renderScreen(<Yearly />)
    expect(screen.getByText(/누구 카드로 쓸까/)).toBeInTheDocument()
  })
})
