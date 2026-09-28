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

describe('예산 대비 지출 — 정산 전엔 이번 달 소비 기록으로 채운다 (제보 9/10)', () => {
  const items = [
    item('h1', '식비', 1, 500_000, 0),
    item('w1', '식비', 2, 300_000, 0),
  ]
  const confessed = new Map([
    ['1:variable:식비', 120_000],
    ['2:variable:식비', 80_000],
    ['2:variable:카페', 15_000], // 예산 목록엔 없는 카테고리
  ])

  it('정산 전인 두 사람 몫을 기록 합계로 채운다', () => {
    render(<BudgetBars items={items} confessed={confessed} />)
    const row = screen.getByText('식비').closest('div')!.parentElement!
    expect(row.textContent).toContain('20만') // 12만 + 8만
    expect(screen.getByText(/소비 기록으로 채웠어요/)).toBeInTheDocument()
  })

  it('예산 없이 기록만 있는 카테고리도 나온다', () => {
    render(<BudgetBars items={items} confessed={confessed} />)
    expect(screen.getByText('카페')).toBeInTheDocument()
  })

  it('정산한 사람 몫은 정산 금액 그대로 — 기록으로 덮지 않는다', () => {
    const settledItems = [item('h1', '식비', 1, 500_000, 450_000), item('w1', '식비', 2, 300_000, 0)]
    render(<BudgetBars items={settledItems} confessed={confessed} settledMembers={[1]} />)
    const row = screen.getByText('식비').closest('div')!.parentElement!
    expect(row.textContent).toContain('53만') // 남편 45만(정산) + 아내 8만(기록)
  })

  it('결산이 끝난 달엔 기록을 쓰지 않는다', () => {
    render(<BudgetBars items={[item('h1', '식비', 1, 500_000, 450_000)]} confessed={confessed} closed />)
    expect(screen.queryByText(/소비 기록으로 채웠어요/)).not.toBeInTheDocument()
    expect(screen.queryByText('카페')).not.toBeInTheDocument()
  })
})
