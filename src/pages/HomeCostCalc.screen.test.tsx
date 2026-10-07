import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import HomeCostCalc from './HomeCostCalc'
import { renderScreen, seedStore } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'

describe('집 살 때 드는 돈 계산기', () => {
  it('로드맵의 내 집 마련 계획으로 집값·대출을 채우고, 필요한 우리 돈을 보여준다', () => {
    seedStore({})
    useLedgerStore.setState((s) => ({
      profile: {
        ...s.profile,
        roadmap: {
          events: [
            { id: 'h', kind: 'house', ym: '2028-03', price: 500_000_000, loan: 300_000_000 },
          ],
        },
      },
    }))
    renderScreen(<HomeCostCalc />)
    expect(screen.getAllByText('로드맵')).toHaveLength(2)
    expect(screen.getByDisplayValue('500,000,000')).toBeInTheDocument()
    expect(screen.getByText(/잔금날 집값 말고 더 나가는 돈/)).toBeInTheDocument()
    expect(screen.getByText(/필요한 우리 돈/)).toBeInTheDocument()
    expect(screen.getByText('취득세')).toBeInTheDocument()
    expect(screen.getByText('국민주택채권 (근저당)')).toBeInTheDocument()
  })

  it('생애 처음이면 감면, 2주택이면 일시적 2주택 칸이 나온다', async () => {
    seedStore({})
    const { user } = renderScreen(<HomeCostCalc />)
    await user.click(screen.getByLabelText(/생애 처음 사는 집/))
    expect(screen.getByText(/생애최초 200만원 감면/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '2주택' }))
    expect(screen.getByLabelText(/잠깐 2주택/)).toBeInTheDocument()
  })
})
