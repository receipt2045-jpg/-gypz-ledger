import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PostDetail from './PostDetail'
import PostCard from '../components/PostCard'

// vi.mock은 맨 위로 끌어올려지므로 글도 같이 끌어올린다
const POST = vi.hoisted(() => ({
  id: 'p1',
  kind: 'news' as const,
  title: '오늘의 경제 뉴스',
  body: [
    '첫째 줄',
    '둘째 줄',
    '셋째 줄',
    '넷째 줄 — 목록에선 안 보임',
    'https://n.news.naver.com/a/1',
  ].join('\n'),
  postDate: '2026-10-06',
  createdAt: '2026-10-06T00:00:00Z',
}))

vi.mock('../lib/posts', async (orig) => ({
  ...(await orig<typeof import('../lib/posts')>()),
  fetchPost: vi.fn().mockResolvedValue(POST),
}))

describe('오늘의 경제 — 목록은 짧게, 자세히 보기로 전체', () => {
  it('목록 카드는 앞 3줄만, 자세히 보기를 누르면 전체 화면', async () => {
    render(
      <MemoryRouter initialEntries={['/info']}>
        <Routes>
          <Route path="/info" element={<PostCard post={POST} />} />
          <Route path="/info/:id" element={<PostDetail />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText(/셋째 줄/)).toBeInTheDocument()
    expect(screen.queryByText(/넷째 줄/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /자세히 보기/ }))
    expect(await screen.findByText(/넷째 줄/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '오늘의 경제 뉴스' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '기사 보기' })).toHaveAttribute(
      'href',
      'https://n.news.naver.com/a/1',
    )
  })
})
