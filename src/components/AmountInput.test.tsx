import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import AmountInput from './AmountInput'

describe('금액 칸 계산기 (2026-10-07 제보)', () => {
  it('식을 치면 미리 보여주고, 칸을 떠나면 계산한 값이 들어간다', () => {
    const onChange = vi.fn()
    render(<AmountInput value={0} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '38000+12500' } })
    expect(screen.getByText('= 50,500원')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith(50500)
  })

  it('계산기 버튼 → 자판으로 더해서 넣기', () => {
    const onChange = vi.fn()
    render(<AmountInput value={38000} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '계산기' }))
    for (const k of ['+', '1', '2', '0', '0', '0'])
      fireEvent.click(screen.getByRole('button', { name: k }))
    fireEvent.click(screen.getByRole('button', { name: '50,000원 넣기' }))
    expect(onChange).toHaveBeenCalledWith(50000)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('숫자만 치면 예전처럼 바로 들어간다', () => {
    const onChange = vi.fn()
    render(<AmountInput value={0} onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '12,000' } })
    expect(onChange).toHaveBeenCalledWith(12000)
  })
})
