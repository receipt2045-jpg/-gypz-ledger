import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PublicNews from './PublicNews'

const POST = vi.hoisted(() => ({
  id: 'p1',
  kind: 'news' as const,
  title: '오늘의 경제 뉴스',
  body: '첫째 줄\n둘째 줄\n셋째 줄\n넷째 줄',
  postDate: '2026-10-06',
  createdAt: '2026-10-06T00:00:00Z',
}))

vi.mock('../lib/posts', async (orig) => ({
  ...(await orig<typeof import('../lib/posts')>()),
  fetchPosts: vi.fn().mockResolvedValue([POST]),
  fetchPost: vi.fn().mockResolvedValue(POST),
}))

describe('로그인 없이 보는 오늘의 경제 (카톡 링크)', () => {
  it('목록 → 자세히 보기 → 전체 글, 맨 아래 모아불리 시작하기', async () => {
    render(
      <MemoryRouter initialEntries={['/news']}>
        <Routes>
          <Route path="/news" element={<PublicNews />} />
          <Route path="/news/:id" element={<PublicNews />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByText('오늘의 경제 뉴스')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '모아불리 시작하기' })).toHaveAttribute('href', '#/')
    fireEvent.click(screen.getByRole('button', { name: /자세히 보기/ }))
    expect(await screen.findByText(/넷째 줄/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /오늘의 경제/ })).toBeInTheDocument()
  })
})
