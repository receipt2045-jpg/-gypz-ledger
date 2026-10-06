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

describe('하단 탭 — 2026-09-30 개편', () => {
  it('왼쪽부터 가계부 · 자산 · 홈 · 정보 · 설정 순이다', () => {
    seedStore({})
    renderScreen(<TabBar />)
    expect(labels()).toEqual(['가계부', '자산', '홈', '돈 공부', '설정'])
  })

  it('자산 로드맵·게시판 탭은 없다', () => {
    seedStore({})
    renderScreen(<TabBar />)
    expect(screen.queryByRole('link', { name: '자산 로드맵' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '게시판' })).not.toBeInTheDocument()
  })

  it('각 탭이 맞는 화면으로 간다', () => {
    seedStore({})
    renderScreen(<TabBar />)
    const href = (name: string | RegExp) =>
      screen.getByRole('link', { name }).getAttribute('href')
    expect(href('가계부')).toBe('/monthly')
    expect(href('자산')).toBe('/assets')
    expect(href('돈 공부')).toBe('/info')
    expect(href('설정')).toBe('/settings')
  })

  it('오늘 소비 기록을 안 했으면 가계부 탭이 굵어진다', () => {
    seedStore({ memberNo: 2, confessions: [] })
    renderScreen(<TabBar />)
    expect(screen.getByText('가계부')).toHaveClass('font-bold')
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
    expect(screen.getByText('가계부')).not.toHaveClass('font-bold')
  })
})
