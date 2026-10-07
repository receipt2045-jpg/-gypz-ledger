import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import RetireCalc from './RetireCalc'
import { renderScreen, seedStore, TEST_YM } from '../test/renderScreen'

describe('노후 준비 계산기', () => {
  it('연금 자산은 자산 탭, 매달 연금 저축은 가계부로 먼저 채운다', () => {
    seedStore({
      snapshots: [
        {
          ym: TEST_YM,
          items: [
            { id: 'p', kind: 'asset', group: 'pension', name: '연금저축', amount: 9_500_000 },
          ],
        },
      ],
      ledgers: [
        {
          ym: TEST_YM,
          closed: false,
          items: [
            {
              id: 'i',
              group: 'saving',
              category: '연금저축',
              member: 1,
              planned: 300_000,
              actual: 0,
            },
          ],
        },
      ],
    })
    renderScreen(<RetireCalc />)
    expect(screen.getByText('자산')).toBeInTheDocument()
    expect(screen.getByText('가계부')).toBeInTheDocument()
    expect(screen.getByDisplayValue('9,500,000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('300,000')).toBeInTheDocument()
    expect(screen.getByText(/60세에 모이는 돈/)).toBeInTheDocument()
  })

  it('거꾸로 계산 — 노후에 쓰고 싶은 돈을 넣으면 지금 매달 얼마', async () => {
    seedStore({})
    const { user } = renderScreen(<RetireCalc />)
    await user.click(screen.getByRole('tab', { name: /^노후에 얼마/ }))
    expect(screen.getByText(/원금은 남기려면/)).toBeInTheDocument()
    expect(screen.getByText(/까지 다 쓰려면/)).toBeInTheDocument()
  })
})
