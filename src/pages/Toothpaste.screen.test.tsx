import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Toothpaste from './Toothpaste'

function open() {
  render(
    <MemoryRouter initialEntries={['/toothpaste']}>
      <Routes>
        <Route path="/toothpaste" element={<Toothpaste />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('무불소 아기치약 10종 비교 (2026-11-21)', () => {
  it('치약 10종을 다 보여 준다', () => {
    open()
    expect(screen.getByText('벨레다 어린이 무불소 치약')).toBeInTheDocument()
    expect(screen.getByText('투투스 베이비 치약')).toBeInTheDocument()
    expect(screen.getAllByRole('article').length).toBeGreaterThanOrEqual(10 + 3)
  })

  it('쿠팡 링크는 양치 파우치 3종에만, 대가성 문구와 함께', () => {
    open()
    const coupang = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('https://link.coupang.com/'))
    expect(coupang.map((a) => a.getAttribute('href'))).toEqual([
      'https://link.coupang.com/a/iP7Ny3ETw4',
      'https://link.coupang.com/a/iP80Ed467E',
      'https://link.coupang.com/a/iP7FPW2YWO',
    ])
    expect(
      screen.getAllByText(
        '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.',
      ).length,
    ).toBeGreaterThan(0)
  })

  it('비교표 PDF 다운로드 버튼', () => {
    open()
    expect(screen.getByRole('link', { name: /비교표 PDF 다운로드/ })).toHaveAttribute(
      'href',
      'https://drive.google.com/uc?id=1vozo9RKG0savgUfq7qnaTfCH1DtMWUbJ&export=download',
    )
  })
})
