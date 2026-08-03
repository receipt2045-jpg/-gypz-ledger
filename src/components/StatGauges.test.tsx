import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatGauges, { shortWon } from './StatGauges'

describe('shortWon — 게이지 축약 표기', () => {
  // 제보 재현: 순자산 -4천만원이 그냥 "4,000만"으로 보였다
  it('음수는 부호가 붙는다', () => {
    expect(shortWon(-40_000_000)).toBe('-4,000만')
    expect(shortWon(-230_000_000)).toBe('-2.3억')
  })

  it('양수는 그대로', () => {
    expect(shortWon(40_000_000)).toBe('4,000만')
    expect(shortWon(230_000_000)).toBe('2.3억')
    expect(shortWon(0)).toBe('0만')
  })
})

describe('홈 미니 게이지 화면', () => {
  it('순자산이 음수면 화면에도 -가 보인다', () => {
    render(
      <StatGauges
        income={3_000_000}
        expense={2_000_000}
        savingInvestRate={0.3}
        netWorth={-40_000_000}
        targetNetWorth={1_000_000_000}
      />,
    )
    expect(screen.getByText('-4,000만')).toBeInTheDocument()
  })
})
