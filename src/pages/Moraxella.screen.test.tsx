import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Moraxella from './Moraxella'

function open() {
  render(
    <MemoryRouter initialEntries={['/moraxella']}>
      <Routes>
        <Route path="/moraxella" element={<Moraxella />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('모락셀라균 세탁세제 6종 비교 (2026-11-27)', () => {
  it('6종을 다 보여 주고 고른 제품을 표시한다', () => {
    open()
    expect(screen.getAllByRole('article').length).toBe(6)
    expect(screen.getAllByText('랩신 냄새제거 부스터 무향 캡슐').length).toBeGreaterThan(0)
    expect(screen.getByText('결영이네가 고른 것')).toBeInTheDocument()
  })

  it('가격 기준일, 쿠팡 링크는 4종에만 대가성 문구와 함께', () => {
    open()
    expect(screen.getByText(/2026년 11월 17일 기준/)).toBeInTheDocument()
    const coupang = screen
      .queryAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('https://link.coupang.com/'))
    expect(coupang).toHaveLength(4)
    expect(screen.getAllByText(/쿠팡 파트너스 활동의 일환/).length).toBeGreaterThan(0)
  })
})
