import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import BudgetBars from './BudgetBars'
import type { BudgetItem } from '../types'

const item = (
  id: string,
  category: string,
  member: 1 | 2,
  planned: number,
  actual: number,
  group: BudgetItem['group'] = 'variable',
): BudgetItem => ({ id, group, category, member, planned, actual })

describe('예산 대비 지출 — 정산 중에 넣은 항목도 보인다 (제보 2026-09-11)', () => {
  // 남편은 예산 세우기로 넣어 planned가 있고, 아내는 정산 중에 넣어 planned=0·actual만 있다.
  const items = [
    item('h1', '부부생활비', 1, 1_000_000, 1_000_000),
    item('h2', '주거', 1, 380_000, 200_000, 'fixed'),
    item('w1', '수영', 2, 0, 120_000),
    item('w2', '민지생활비', 2, 0, 520_000),
  ]

  it('예산 없이 쓴 카테고리도 목록에 나온다', () => {
    render(<BudgetBars items={items} />)
    expect(screen.getByText('수영')).toBeInTheDocument()
    expect(screen.getByText('민지생활비')).toBeInTheDocument()
  })

  it("예산이 없으면 '/ 예산 없음'으로 표시하고 초과(빨강)로 몰지 않는다", () => {
    render(<BudgetBars items={items} />)
    const row = screen.getByText('수영').closest('div')!.parentElement!
    expect(row.textContent).toContain('예산 없음')
    expect(row.querySelector('.bg-danger')).toBeNull()
  })

  it('예산 있는 것이 먼저, 예산 없는 것은 뒤에 쓴 돈 큰 순', () => {
    render(<BudgetBars items={items} />)
    const names = screen
      .getAllByText(/부부생활비|주거|수영|민지생활비/)
      .map((el) => el.textContent)
    expect(names).toEqual(['부부생활비', '주거', '민지생활비', '수영'])
  })

  it('합계 지출에는 예산 없는 지출도 들어간다', () => {
    render(<BudgetBars items={items} />)
    // 100만 + 20만 + 12만 + 52만 = 184만
    expect(screen.getByText(/184만/)).toBeInTheDocument()
  })

  it('예산이 하나도 없고 쓴 것만 있으면 비율 대신 "예산 없음"', () => {
    render(<BudgetBars items={[item('w1', '수영', 2, 0, 120_000)]} />)
    expect(screen.getAllByText(/예산 없음/).length).toBeGreaterThanOrEqual(2) // 헤더 + 행
  })

  it('둘 다 없으면 예전처럼 안내문', () => {
    render(<BudgetBars items={[item('z', '식비', 1, 0, 0)]} />)
    expect(screen.getByText(/예산 세우기/)).toBeInTheDocument()
  })
})
