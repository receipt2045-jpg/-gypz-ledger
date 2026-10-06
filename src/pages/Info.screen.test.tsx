import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Info from './Info'

// 글은 DB에서 온다 — 테스트에서는 네트워크 대신 정해 둔 글로
vi.mock('../lib/posts', async (orig) => ({
  ...(await orig<typeof import('../lib/posts')>()),
  amIAdmin: vi.fn().mockResolvedValue(false),
  fetchNewsMeta: vi.fn().mockResolvedValue({}),
  fetchPosts: vi.fn().mockResolvedValue([
    {
      id: 'n1',
      kind: 'news',
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
      id: 'p1',
      kind: 'market',
      title: '미국 증시 마감 정리',
      body: [
        '🔰 한 줄 정리',
        '미국 주식이 거의 제자리에서 조금 올랐어요.',
        'https://n.news.naver.com/a/1',
      ].join('\n'),
      postDate: '2026-10-02',
      createdAt: '2026-10-02T00:00:00Z',
    },
  ]),
}))

describe('정보 탭 — 공지 · 계산기 · 정보·혜택 · 이야기', () => {
  const renderInfo = () =>
    render(
      <MemoryRouter initialEntries={['/info']}>
        <Routes>
          <Route path="/info" element={<Info />} />
          <Route path="/leave" element={<p>계산기 화면</p>} />
          <Route path="/info/archive" element={<p>지난 글 화면</p>} />
        </Routes>
      </MemoryRouter>,
    )

  it('육아휴직 계산기 소식이 공지로 보인다', () => {
    renderInfo()
    expect(screen.getByText('🍼 육아휴직 계산기가 나왔어요')).toBeInTheDocument()
    expect(screen.getByText('9월 30일')).toBeInTheDocument()
  })

  it('오늘의 경제가 맨 위, 바로 아래 계산기 — 뉴스에 계산기가 밀려나지 않게', async () => {
    renderInfo()
    await screen.findByText('매물 고갈된 전세 시장')
    const names = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))
    expect(names).toEqual(['오늘의 경제', '계산기', '공지', '정보·혜택', '이야기'])
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

  it('경제 뉴스는 기사 하나씩 — 그날의 픽이 큰 카드, 증시 정리 탭은 최근 하루치', async () => {
    renderInfo()
    expect(await screen.findByText('매물 고갈된 전세 시장')).toBeInTheDocument()
    expect(screen.getByText('오늘 딱 하나만 읽는다면')).toBeInTheDocument()
    expect(screen.getByText('전세 매물이 말라요.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /나스닥 사상 최고치/ })).toHaveAttribute(
      'href',
      'https://n.news.naver.com/a/1',
    )
    fireEvent.click(screen.getByRole('button', { name: /주식/ }))
    expect(screen.queryByText('매물 고갈된 전세 시장')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '증시 정리' }))
    expect(screen.getByText('미국 주식이 거의 제자리에서 조금 올랐어요.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /지난 증시 정리 보기/ }))
    expect(screen.getByText('지난 글 화면')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /글 올리기/ })).not.toBeInTheDocument()
  })
})
