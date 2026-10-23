import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import OneTeamCard from './OneTeamCard'

describe('원팀프로젝트 카드 — 고민 문구가 3초마다 바뀐다 (2026-10-23)', () => {
  afterEach(() => vi.useRealTimers())

  it('첫 고민부터, 3초 뒤 다음 고민, 마지막 다음엔 처음으로', () => {
    vi.useFakeTimers()
    render(<OneTeamCard onStory={() => {}} variant="lines" />)
    const shown = () => screen.getByText('우리가 많이 쓰는 건지', { selector: 'span' })
    expect(shown()).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(3000))
    expect(screen.getByText('아무도 안 해준다', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByText('우리가 많이 쓰는 건지', { selector: 'span' })).toBeNull()

    act(() => vi.advanceTimersByTime(9000))
    expect(shown()).toBeInTheDocument()
  })

  it('대화 모양: 부부 말풍선 (2026-10-24)', () => {
    render(<OneTeamCard onStory={() => {}} variant="talk" />)
    expect(screen.getByText('우리가 많이 쓰는 건가?')).toBeInTheDocument()
    expect(screen.getByText('남편')).toBeInTheDocument()
  })
})
