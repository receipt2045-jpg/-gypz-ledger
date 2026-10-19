import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import LoanFinderCalc from './LoanFinderCalc'
import { renderScreen, seedStore } from '../test/renderScreen'

describe('내집마련 대출 찾기', () => {
  it('받을 수 있는 대출을 보여 주고, 출산을 고르면 신생아 특례가 받을 수 있는 쪽으로 온다', async () => {
    seedStore({})
    const { user } = renderScreen(<LoanFinderCalc />)
    expect(screen.getByText('필요한 대출')).toBeInTheDocument()
    expect(screen.queryByTestId('loan-baby')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '2년 안에 출산' }))
    expect(screen.getByTestId('loan-baby')).toBeInTheDocument()
  })

  it('KB시세 같은 건 바로가기 링크로 — 새 창에서 연다', () => {
    seedStore({})
    renderScreen(<LoanFinderCalc />)
    const kb = screen.getByRole('link', { name: /KB시세 보기/ })
    expect(kb).toHaveAttribute('href', 'https://kbland.kr')
    expect(kb).toHaveAttribute('target', '_blank')
  })

  it('집값이 6억을 넘으면 보금자리론은 어려운 대출로 내려간다', async () => {
    seedStore({})
    const { user } = renderScreen(<LoanFinderCalc />)
    const deal = screen.getAllByDisplayValue('500,000,000')[0] // 매매가 (그다음이 KB시세)
    await user.clear(deal)
    await user.type(deal, '700000000')
    await user.tab()
    expect(screen.queryByTestId('loan-bogeum')).not.toBeInTheDocument()
    const blocked = screen.getByText('지금 조건으론 어려운 대출').parentElement!
    expect(within(blocked).getByText('보금자리론')).toBeInTheDocument()
  })

  it('결영이네에 물어보기·과제 복사 버튼은 없다', () => {
    seedStore({})
    renderScreen(<LoanFinderCalc />)
    expect(screen.queryByText(/결영이네에 물어보기/)).not.toBeInTheDocument()
    expect(screen.queryByText(/과제 양식으로 복사/)).not.toBeInTheDocument()
  })
})
