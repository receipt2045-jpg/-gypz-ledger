import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FixedCostCheck from './FixedCostCheck'
import type { BudgetItem } from '../types'

import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'

// 컴포넌트가 useNavigate를 쓰므로 라우터로 감싸서 띄운다
const renderWithRouter = (ui: ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)


const item = (
  group: BudgetItem['group'],
  category: string,
  amount: number,
  member: 1 | 2 = 1,
): BudgetItem => ({
  id: `${group}-${category}-${member}`,
  group,
  category,
  member,
  planned: amount,
  actual: amount,
})

const income500 = [item('income', '주수입', 3_000_000, 1), item('income', '주수입', 2_000_000, 2)]

describe('고정비 점검 카드', () => {
  it('고정지출이 없으면 카드를 아예 띄우지 않는다', () => {
    const { container } = renderWithRouter(<FixedCostCheck items={income500} closed />)
    expect(container).toBeEmptyDOMElement()
  })

  it('줄일 여지를 금액과 10년치로 보여준다', () => {
    // 수입 500만, 보험 70만 → 상한 50만, 20만 초과 → 10년 2,400만
    renderWithRouter(<FixedCostCheck items={[...income500, item('fixed', '보험', 700_000)]} closed />)
    expect(screen.getByText(/매달 200,000원 줄일 여지/)).toBeInTheDocument()
    expect(screen.getByText('2,400만원')).toBeInTheDocument()
  })

  // 순위로 줄 세우면 위축만 시킨다 — 그렇게 보여주지 않기로 한 결정
  it('상위 몇 % 같은 순위 표현은 쓰지 않는다', () => {
    renderWithRouter(<FixedCostCheck items={[...income500, item('fixed', '보험', 700_000)]} closed />)
    expect(screen.queryByText(/상위/)).not.toBeInTheDocument()
    expect(screen.queryByText(/하위/)).not.toBeInTheDocument()
  })

  it('다 괜찮으면 줄일 여지 안내를 띄우지 않는다', () => {
    renderWithRouter(<FixedCostCheck items={[...income500, item('fixed', '통신', 150_000)]} closed />)
    expect(screen.queryByText(/줄일 여지/)).not.toBeInTheDocument()
    expect(screen.getByText(/잘 잡혀 있습니다/)).toBeInTheDocument()
  })

  it('수입이 없으면 판단 대신 안내를 보여준다', () => {
    renderWithRouter(<FixedCostCheck items={[item('fixed', '보험', 500_000)]} closed />)
    expect(screen.getByText(/수입을 넣으면/)).toBeInTheDocument()
    expect(screen.getByText('기준 없음')).toBeInTheDocument()
  })

  it('기준의 출처를 펼쳐 볼 수 있다', async () => {
    const user = userEvent.setup()
    renderWithRouter(<FixedCostCheck items={[...income500, item('fixed', '주거', 1_000_000)]} closed />)

    expect(screen.queryByText(/주거비 30% 법칙/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /기준이 궁금하다면/ }))
    expect(screen.getByText(/주거비 30% 법칙/)).toBeInTheDocument()
    expect(screen.getByText(/정답은 아니에요/)).toBeInTheDocument()
  })

  it('맞춤 리포트로 가는 입구가 있다', () => {
    // 자기 숫자를 막 확인한 자리 — '그래서 뭘 줄이지'로 이어준다
    renderWithRouter(<FixedCostCheck items={[...income500, item('fixed', '주거', 1_000_000)]} closed />)
    expect(screen.getByRole('button', { name: /우리집은 뭘 줄여야 할까요/ })).toBeInTheDocument()
  })
})
