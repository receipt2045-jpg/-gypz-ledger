import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Story, { STORY_URL } from './Story'

const KAKAO_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.5'

describe('원팀 프로젝트 이야기', () => {
  afterEach(() => vi.restoreAllMocks())

  it('보통 브라우저에선 앱 안에 이야기 페이지를 띄운다', () => {
    render(
      <MemoryRouter>
        <Story />
      </MemoryRouter>,
    )
    expect(screen.getByTitle('원팀 프로젝트 5기 이야기')).toHaveAttribute('src', STORY_URL)
  })

  // 제보: 카톡에서 공유하면 마지막 6기 버튼이 안 눌려요
  it('카톡 안에서 열면 이야기 페이지로 바로 넘어간다', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(KAKAO_UA)
    const replace = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      replace,
    } as Location)
    render(
      <MemoryRouter>
        <Story />
      </MemoryRouter>,
    )
    expect(replace).toHaveBeenCalledWith(STORY_URL)
    expect(screen.queryByTitle('원팀 프로젝트 5기 이야기')).not.toBeInTheDocument()
  })
})
