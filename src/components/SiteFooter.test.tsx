import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SiteFooter from './SiteFooter'
import FeedbackFab from './FeedbackFab'

describe('맨 아래 사업자 정보 · 어디서나 의견 보내기', () => {
  it('사업자 정보와 참고 자료 안내, 약관 링크', () => {
    render(<SiteFooter news />)
    expect(screen.getByText(/상호 마이머니플랜/)).toBeInTheDocument()
    expect(screen.getByText(/223-29-01904/)).toBeInTheDocument()
    expect(screen.getByText(/참고 자료/)).toBeInTheDocument()
    expect(screen.getByText(/저작권은 각 언론사/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '#/legal/terms')
  })

  it('의견 보내기 버튼 → 창이 열리고 닫힌다', () => {
    render(
      <MemoryRouter initialEntries={['/assets']}>
        <FeedbackFab />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /의견 보내기/ }))
    expect(screen.getByRole('dialog', { name: '의견 보내기' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
