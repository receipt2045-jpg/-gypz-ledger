import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import TabBar from './TabBar'
import { renderScreen, seedStore } from '../test/renderScreen'

/** 하단 탭에 보이는 글자들을 왼쪽부터 순서대로 */
const labels = () =>
  screen
    .getAllByRole('link')
    .map((a) => a.textContent?.trim())
    .filter(Boolean)

describe('하단 탭 — 2026-09-09 개편', () => {
  it('왼쪽부터 자산 로드맵 · 소비 기록 · 홈 · 게시판 · 설정 순이다', () => {
    seedStore({})
    renderScreen(<TabBar />)
    expect(labels()).toEqual(['자산 로드맵', '오늘의 소비 기록', '홈', '게시판', '설정'])
  })

  it('자산·가계부 탭은 없다 — 홈에서 들어간다', () => {
    seedStore({})
    renderScreen(<TabBar />)
    expect(screen.queryByRole('link', { name: '자산' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '가계부' })).not.toBeInTheDocument()
  })

  it('각 탭이 맞는 화면으로 간다', () => {
    seedStore({})
    renderScreen(<TabBar />)
    const href = (name: string | RegExp) =>
      screen.getByRole('link', { name }).getAttribute('href')
    expect(href('자산 로드맵')).toBe('/roadmap')
    expect(href('오늘의 소비 기록')).toBe('/confess')
    expect(href('게시판')).toBe('/board')
    expect(href('설정')).toBe('/settings')
  })

  it('오늘 기록을 안 했으면 소비 기록 탭이 굵어진다', () => {
    seedStore({ memberNo: 2, confessions: [] })
    renderScreen(<TabBar />)
    const label = screen.getByText('오늘의 소비 기록')
    expect(label).toHaveClass('font-bold')
  })

  it('오늘 기록했으면 강조가 빠진다', () => {
    seedStore({
      memberNo: 2,
      confessions: [
        {
          id: 'c1',
          memberNo: 2,
          category: '식비',
          kind: 'variable',
          amount: 9_000,
          createdAt: new Date().toISOString(),
        },
      ],
    })
    renderScreen(<TabBar />)
    expect(screen.getByText('오늘의 소비 기록')).not.toHaveClass('font-bold')
  })
})
