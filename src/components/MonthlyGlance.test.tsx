import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MonthlyGlance from './MonthlyGlance'
import SectionList from './SectionList'
import type { BudgetItem, MonthlyLedger } from '../types'

const item = (
  id: string,
  group: BudgetItem['group'],
  category: string,
  member: 1 | 2,
  planned: number,
  shared = false,
): BudgetItem => ({
  id,
  group,
  category,
  member,
  planned,
  actual: 0,
  ...(shared ? { shared } : {}),
})

const ledger: MonthlyLedger = {
  ym: '2026-10',
  closed: false,
  items: [
    item('a', 'income', '주수입', 1, 1_000_000),
    item('b', 'income', '주수입', 2, 3_000_000),
    item('c', 'saving', '적금', 1, 500_000),
    item('d', 'fixed', '주거', 1, 1_250_000, true),
    item('e', 'fixed', '보험', 2, 230_000),
    item('f', 'variable', '식비', 2, 800_000),
  ],
}

describe('가계부 탭 한눈에', () => {
  it('남는 돈을 크게, 계산식과 링 네 개, 링 네 개를 보여 준다', () => {
    render(<MonthlyGlance ledger={ledger} />)
    expect(screen.getByText('10월 남는 돈')).toBeInTheDocument()
    // 400 − 50 − 148 − 80 = 122만
    expect(screen.getByText('122만원')).toBeInTheDocument()
    expect(screen.getByText('정산 전 · 계획 기준')).toBeInTheDocument()
    for (const label of ['수입', '저축·투자', '고정비', '생활비'])
      expect(screen.getByText(label)).toBeInTheDocument()
    expect(screen.getByText('수입의 37%')).toBeInTheDocument() // 고정비 148/400
    expect(screen.queryByText('누가 얼마나 벌었나')).not.toBeInTheDocument()
  })
})

describe('자세히 — 그룹별 목록', () => {
  it('처음엔 접혀 있고 누르면 항목이 펼쳐진다. 공동 항목은 공동으로 표시', async () => {
    const user = userEvent.setup()
    render(
      <SectionList
        title="고정지출"
        items={ledger.items.filter((it) => it.group === 'fixed')}
        closed={false}
        goodWhenOver={false}
        memberNames={['남편', '아내']}
      />,
    )
    expect(screen.getByText('2건')).toBeInTheDocument()
    expect(screen.queryByText('주거')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /고정지출/ }))
    expect(screen.getByText('주거')).toBeInTheDocument()
    expect(screen.getByText('공동')).toBeInTheDocument()
  })
})
