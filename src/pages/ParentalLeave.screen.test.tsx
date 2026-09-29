import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ParentalLeave from './ParentalLeave'

describe('육아휴직 계산기 화면', () => {
  beforeEach(() => localStorage.clear())

  it('처음 열면 예시 숫자로 한 줄 결론과 구간 칸이 바로 보인다', () => {
    render(<ParentalLeave />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      '매달 160만원 모으던 우리집,육아휴직하면 한 달에 🍼',
    )
    expect(screen.getAllByText('120만').length).toBeGreaterThan(0)
    expect(screen.getAllByText('모여요')).toHaveLength(3)
  })

  it('둘 다 같이 쉬면 적자예요 칸이 나온다', () => {
    render(<ParentalLeave />)
    fireEvent.click(screen.getByRole('button', { name: '둘 다' }))
    fireEvent.click(screen.getByRole('button', { name: /우리집에 맞게 고치기/ }))
    fireEvent.click(screen.getByRole('button', { name: '같이' }))
    expect(screen.getAllByText('적자예요').length).toBeGreaterThan(0)
    expect(screen.getAllByText('둘 다 휴직').length).toBeGreaterThan(0)
  })

  it('원팀프로젝트 링크와 모아불리 시작하기가 있다', () => {
    render(<ParentalLeave />)
    expect(screen.getByRole('link', { name: /원팀프로젝트 보러가기/ })).toHaveAttribute(
      'href',
      'https://oneteamm.netlify.app',
    )
    expect(screen.getByRole('link', { name: '모아불리 시작하기' })).toHaveAttribute('href', '#/')
  })

  it('숫자를 고치면 다음에 열 때도 남아 있다', () => {
    const { unmount } = render(<ParentalLeave />)
    fireEvent.click(screen.getByRole('button', { name: '남편' }))
    unmount()
    render(<ParentalLeave />)
    expect(screen.getByRole('button', { name: '남편' })).toHaveAttribute('aria-pressed', 'true')
  })
})
