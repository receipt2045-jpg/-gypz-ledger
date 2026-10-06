import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PublicNews from './PublicNews'

const POSTS = vi.hoisted(() => [
  {
    id: 'n1',
    kind: 'news' as const,
    title: '오늘의 경제 뉴스',
    body: [
      '🔰 오늘 딱 하나만 읽는다면',
      '부동산 1번 뉴스, 전세 매물이 말라요.',
      '',
      '■ 주식',
      '1. 나스닥 사상 최고치',
      '→ 美 장기금리 최고',
      'https://n.news.naver.com/a/1',
      '',
      '■ 부동산',
      '1. 매물 고갈된 전세 시장',
      '→ 전세 매물 실종',
      'https://n.news.naver.com/a/2',
    ].join('\n'),
    postDate: '2026-10-06',
    createdAt: '2026-10-06T00:00:00Z',
  },
  {
    id: 'm1',
    kind: 'market' as const,
    title: '미국 증시 마감 정리',
    body: '🔰 한 줄 정리\n미국 주식이 올랐어요.',
    postDate: '2026-10-06',
    createdAt: '2026-10-06T00:10:00Z',
  },
  {
    id: 'm2',
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
  fetchNewsMeta: vi.fn().mockResolvedValue({
    'https://n.news.naver.com/a/2': { image: 'https://imgnews.pstatic.net/x.jpg?type=w800', press: '뉴시스' },
  }),
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
  it('경제 뉴스 — 기사 하나씩, 그날의 픽은 사진·언론사와 큰 카드 → 결영이네 정리 전체', async () => {
    renderAt('/news')
    expect(await screen.findByText('매물 고갈된 전세 시장')).toBeInTheDocument()
    expect(screen.getByText('지금까지 기사 2개를 모아 뒀어요')).toBeInTheDocument()
    expect(screen.getByText(/뉴시스 ·/)).toBeInTheDocument()
    expect(document.querySelector('img[src*="type=w647"]')).not.toBeNull()
    expect(screen.getByRole('link', { name: '모아불리 시작하기' })).toHaveAttribute('href', '#/')

    fireEvent.click(screen.getByRole('link', { name: /결영이네 정리 전체 보기/ }))
    expect(await screen.findByText(/전세 매물이 말라요/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /오늘의 경제/ })).toBeInTheDocument()
  })

  it('증시 정리 — 맨 위 달만 펼쳐 있고, 지난달은 눌러야 보인다', async () => {
    renderAt('/news?tab=market')
    expect(await screen.findByText('미국 주식이 올랐어요.')).toBeInTheDocument()
    expect(screen.queryByText('코스피가 올랐어요.')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /2026년 9월/ }))
    expect(screen.getByText('코스피가 올랐어요.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '경제 뉴스' }))
    expect(screen.getByText('나스닥 사상 최고치')).toBeInTheDocument()
  })
})
