import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Share from './Share'
import ShareMore from '../components/ShareMore'

function open(path: string) {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/share" element={<Share />} />
        <Route path="/gold" element={<ShareMore />} />
        <Route path="/leave" element={<p>육아휴직 화면</p>} />
        <Route path="/gift-guide" element={<p>증여 신고 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )
  return { user }
}

describe('자료 나눔 목록 · 다른 자료 (2026-10-24)', () => {
  it('분류 칩으로 거른다', async () => {
    const { user } = open('/share')
    expect(screen.getByText('결영이네 자료 나눔')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '육아' }))
    expect(screen.getAllByText('육아휴직하면 매달 얼마 남을까').length).toBeGreaterThan(0)
    expect(screen.queryByText('같은 100만 원어치인데', { exact: false })).not.toBeInTheDocument()
  })

  it('금테크 맨 끝: 금테크는 빼고 다른 자료로 넘어간다', async () => {
    const { user } = open('/gold')
    expect(screen.getByText('이런 자료도 있어요')).toBeInTheDocument()
    expect(screen.queryByText('금 처음 산다면, 수수료부터 보세요')).not.toBeInTheDocument()
    await user.click(screen.getByText('아이 통장에 넣은 돈, 증여 신고 해야 할까?'))
    expect(screen.getByText('증여 신고 화면')).toBeInTheDocument()
  })
})
