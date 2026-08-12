import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SampleReport from './SampleReport'

describe('SampleReport 화면', () => {
  it('접힌 상태로 시작하고, 펼치면 예시 리포트가 보인다', async () => {
    render(<SampleReport />)

    expect(screen.getByText('실제로 이렇게 받아요')).toBeInTheDocument()
    expect(screen.queryByText(/민준·다은 님/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('실제로 이렇게 받아요'))

    expect(screen.getByText(/민준·다은 님, 결영이네입니다/)).toBeInTheDocument()
    expect(screen.getByText('우리집 숫자')).toBeInTheDocument()
    expect(screen.getByText(/가상의 부부 예시예요/)).toBeInTheDocument()
  })

  it('다시 누르면 접힌다', async () => {
    render(<SampleReport />)
    const toggle = screen.getByText('실제로 이렇게 받아요')

    await userEvent.click(toggle)
    await userEvent.click(toggle)

    expect(screen.queryByText(/민준·다은 님/)).not.toBeInTheDocument()
  })
})
