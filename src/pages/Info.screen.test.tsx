import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Info from './Info'

describe('정보 탭 — 공지 · 계산기 · 정보·혜택 · 이야기', () => {
  const renderInfo = () =>
    render(
      <MemoryRouter initialEntries={['/info']}>
        <Routes>
          <Route path="/info" element={<Info />} />
          <Route path="/leave" element={<p>계산기 화면</p>} />
        </Routes>
      </MemoryRouter>,
    )

  it('육아휴직 계산기 소식이 공지로 보인다', () => {
    renderInfo()
    expect(screen.getByText('🍼 육아휴직 계산기가 나왔어요')).toBeInTheDocument()
    expect(screen.getByText('9월 30일')).toBeInTheDocument()
  })

  it('네 칸이 차례로 있다', () => {
    renderInfo()
    const names = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))
    expect(names).toEqual(['공지', '계산기', '정보·혜택', '이야기'])
  })

  it('공지의 계산해보기로 계산기에 간다', () => {
    renderInfo()
    fireEvent.click(screen.getByRole('button', { name: /계산해보기/ }))
    expect(screen.getByText('계산기 화면')).toBeInTheDocument()
  })

  it('계산기 칸에서도 육아휴직 계산기로 간다', () => {
    renderInfo()
    fireEvent.click(screen.getByRole('button', { name: /육아휴직 계산기/ }))
    expect(screen.getByText('계산기 화면')).toBeInTheDocument()
  })
})
