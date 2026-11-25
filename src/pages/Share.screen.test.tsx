import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Share from './Share'
import ShareMore from '../components/ShareMore'
import { otherShares, sharesByDate } from '../lib/shares'

// 금테크 맨 끝 '다른 자료' 첫 칸 — 새 자료가 올라와도 테스트가 안 깨지게 (11-19)
// 같은 분류(재테크)가 먼저라, 다른 분류 새 자료(11-21 육아 치약)가 올라와도 여기 안 걸린다
const NEWEST = otherShares('/gold')[0]

function open(path: string) {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/share" element={<Share />} />
        <Route path="/gold" element={<ShareMore />} />
        <Route path="/leave" element={<p>육아휴직 화면</p>} />
        <Route path="/gift-guide" element={<p>증여 신고 화면</p>} />
        <Route path={NEWEST.path} element={<p>최근 자료 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )
  return { user }
}

describe('자료 나눔 목록 · 다른 자료 (2026-10-24)', () => {
  it('분류 칩으로 거른다', async () => {
    const { user } = open('/share')
    expect(screen.getByText('결영이네 자료 나눔')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^육아\s*\d+$/ }))
    expect(screen.getAllByText('육아휴직하면 매달 얼마 남을까').length).toBeGreaterThan(0)
    expect(screen.queryByText('같은 100만 원어치인데', { exact: false })).not.toBeInTheDocument()
  })

  it('금테크 맨 끝: 금테크는 빼고 다른 자료로 넘어간다', async () => {
    const { user } = open('/gold')
    expect(screen.getByText('이런 자료도 있어요')).toBeInTheDocument()
    expect(screen.queryByText('금 처음 산다면, 수수료부터 보세요')).not.toBeInTheDocument()
    await user.click(screen.getAllByText(NEWEST.title)[0])
    expect(screen.getByText('최근 자료 화면')).toBeInTheDocument()
  })
})

describe('자료 나눔 분류 (2026-11-21)', () => {
  it('분류 칩에 개수가 붙고, 주소(?c=)로 그 분류만 열린다', () => {
    open('/share?c=%EC%9C%A1%EC%95%84')
    expect(screen.getByRole('heading', { name: /^육아 자료 \d+개$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^육아\s*\d+$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // 다른 분류 자료는 안 보인다
    expect(screen.queryByText('코픽스 오르면, 우리집 이자는 얼마 더?')).not.toBeInTheDocument()
    // 분류를 고르면 '새로 올라온 자료'는 빼고 그 분류 목록만
    expect(screen.queryByRole('heading', { name: '새로 올라온 자료' })).not.toBeInTheDocument()
  })

  it('쿠팡·설문은 짠테크, 재건축 정리표는 내집마련', () => {
    const cats = Object.fromEntries(sharesByDate().map((s) => [s.slug, s.category]))
    expect(cats.coupang).toBe('짠테크')
    expect(cats.survey).toBe('짠테크')
    expect(cats['money-jaechohwan']).toBe('내집마련')
  })
})
