import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Toggle from './Toggle'

describe('Toggle', () => {
  it('누르면 반대 값으로 onChange', async () => {
    const onChange = vi.fn()
    render(<Toggle label="테스트" checked={false} onChange={onChange} />)
    const sw = screen.getByRole('switch', { name: '테스트' })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    await userEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)
  })
  it('disabled면 onChange를 부르지 않는다', async () => {
    const onChange = vi.fn()
    render(<Toggle label="테스트" checked disabled onChange={onChange} />)
    await userEvent.click(screen.getByRole('switch', { name: '테스트' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
