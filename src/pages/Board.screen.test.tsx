import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Board from './Board'

describe('게시판 — 공지', () => {
  const renderBoard = () =>
    render(
      <MemoryRouter initialEntries={['/board']}>
        <Routes>
          <Route path="/board" element={<Board />} />
          <Route path="/leave" element={<p>계산기 화면</p>} />
        </Routes>
      </MemoryRouter>,
    )

  it('육아휴직 계산기 소식이 공지로 보인다', () => {
    renderBoard()
    expect(screen.getByText('🍼 육아휴직 계산기가 나왔어요')).toBeInTheDocument()
    expect(screen.getByText('9월 30일')).toBeInTheDocument()
  })

  it('계산해보기를 누르면 계산기로 간다', () => {
    renderBoard()
    fireEvent.click(screen.getByRole('button', { name: /계산해보기/ }))
    expect(screen.getByText('계산기 화면')).toBeInTheDocument()
  })
})
