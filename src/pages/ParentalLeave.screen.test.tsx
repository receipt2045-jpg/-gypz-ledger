import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ParentalLeave from './ParentalLeave'
import { DEFAULT_INPUT } from '../lib/parentalLeave'
import { encodeLeave } from '../lib/leaveShare'

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

  it('24개월 이상을 고르면 −/+로 개월 수를 고르고, 무급 기간을 알려준다', () => {
    render(<ParentalLeave />)
    fireEvent.click(screen.getByRole('button', { name: /우리집에 맞게 고치기/ }))
    fireEvent.click(screen.getByRole('button', { name: '24개월 이상' }))
    expect(screen.getAllByText('24개월').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: '한 달 늘리기' }))
    expect(screen.getByRole('button', { name: '한 달 줄이기' }).nextSibling?.textContent).toBe('25개월')
    expect(screen.getByText('13~25개월째는 무급이에요.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '자세히 보기' }))
    expect(screen.getAllByText('무급').length).toBeGreaterThan(0)
  })

  it('육아휴직급여를 못 받아요를 고르면 쉬는 동안 버는 돈 칸이 열린다', () => {
    render(<ParentalLeave />)
    fireEvent.click(screen.getByRole('button', { name: /우리집에 맞게 고치기/ }))
    fireEvent.click(screen.getByRole('button', { name: '못 받아요' }))
    expect(screen.getByText('쉬는 동안 버는 돈 (월)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '자세히 보기' }))
    expect(screen.getAllByText('쉬는 중').length).toBeGreaterThan(0)
  })

  it('자세히 보기는 처음엔 접혀 있고, 누르면 한 달 계산 표가 열린다', () => {
    render(<ParentalLeave />)
    expect(screen.queryByText('들어오는 돈')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '자세히 보기' }))
    expect(screen.getByText('들어오는 돈')).toBeInTheDocument()
  })

  it('처음 온 사람에게 우리집 숫자로 바꿔보라고 알려준다', () => {
    render(<ParentalLeave />)
    expect(screen.getByRole('button', { name: /우리집 숫자로 바꿔보세요/ })).toBeInTheDocument()
    expect(screen.getByText(/지금 보이는 건 예시 숫자예요/)).toBeInTheDocument()
  })

  it('남편이 보낸 링크로 열면 그 숫자로 계산한다', () => {
    window.location.hash = `#/leave?s=${encodeLeave({ ...DEFAULT_INPUT, who: 'husband' })}`
    render(<ParentalLeave />)
    expect(screen.getByRole('button', { name: '남편' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/공유받은 숫자로 계산했어요/)).toBeInTheDocument()
    window.location.hash = ''
  })

  it('공유가 안 되는 브라우저면 링크를 복사한다', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<ParentalLeave />)
    fireEvent.click(screen.getByRole('button', { name: /남편한테 공유하기/ }))
    expect(await screen.findByText(/링크를 복사했어요/)).toBeInTheDocument()
    expect(writeText.mock.calls[0][0]).toContain('/#/leave?s=')
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
