import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PublicNews from './PublicNews'

const POSTS = vi.hoisted(() => [
  {
    id: 'p1',
    kind: 'news' as const,
    title: '오늘의 경제 뉴스',
    body: '🔰 오늘 딱 하나만 읽는다면\n부동산 2번 뉴스, 전세 매물이 말라요.\n\n둘째 줄\n넷째 줄',
    postDate: '2026-10-06',
    createdAt: '2026-10-06T00:00:00Z',
  },
  {
    id: 'p2',
    kind: 'market' as const,
    title: '국내 주식 마감 시황',
    body: '🔰 한 줄 정리\n코스피가 올랐어요.',
    postDate: '2026-09-30',
    createdAt: '2026-09-30T10:00:00Z',
  },
])

vi.mock('../lib/posts', async (orig) => ({
  ...(await orig<typeof import('../lib/posts')>()),
  fetchPosts: vi.fn().mockResolvedValue(POSTS),
  fetchPost: vi.fn().mockResolvedValue(POSTS[0]),
}))

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/news" element={<PublicNews />} />
        <Route path="/news/:id" element={<PublicNews />} />
      </Routes>
    </MemoryRouter>,
  )

describe('로그인 없이 보는 오늘의 경제 (카톡 링크)', () => {
  it('달별 목록 → 한 줄 눌러 전체 글, 맨 아래 모아불리 시작하기', async () => {
    renderAt('/news')
    expect(await screen.findByText('전세 매물이 말라요.')).toBeInTheDocument()
    expect(screen.getByText('지금까지 2개 글을 모아 뒀어요')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '모아불리 시작하기' })).toHaveAttribute('href', '#/')
    fireEvent.click(screen.getByRole('button', { name: /전세 매물이 말라요/ }))
    expect(await screen.findByText(/넷째 줄/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /오늘의 경제/ })).toBeInTheDocument()
  })

  it('맨 위 달만 펼쳐 있고, 지난달은 눌러야 보인다 · 종류로 거른다', async () => {
    renderAt('/news')
    await screen.findByText('전세 매물이 말라요.')
    expect(screen.queryByText('코스피가 올랐어요.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /2026년 9월/ }))
    expect(screen.getByText('코스피가 올랐어요.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '증시 정리' }))
    expect(screen.queryByText('전세 매물이 말라요.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /2026년 10월/ })).not.toBeInTheDocument()
  })
})
