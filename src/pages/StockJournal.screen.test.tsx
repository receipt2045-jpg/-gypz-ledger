import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Stocks from './Stocks'
import StockJournal from './StockJournal'
import { seedStore } from '../test/renderScreen'

function open(path: string) {
  seedStore({ memberNo: 1 }) // householdId 없음 → 예시 일지(메모리)
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/stocks" element={<Stocks />} />
        <Route path="/stocks/:id" element={<StockJournal />} />
      </Routes>
    </MemoryRouter>,
  )
  return { user }
}

describe('주식 일지 (2026-10-25)', () => {
  it('목록: 종목별 지금 금액·수익률·목표가까지', async () => {
    open('/stocks')
    expect(await screen.findByText('SK하이닉스')).toBeInTheDocument()
    expect(screen.getByText('2,500,000원')).toBeInTheDocument()
    expect(screen.getByText('+25.0%')).toBeInTheDocument()
    expect(screen.getByText(/목표가 300,000원까지 20% 남음/)).toBeInTheDocument()
  })

  it('종목 일지: 오늘 샀어요 → 평균이 바뀌고 기록이 쌓인다, 배우자 한 줄', async () => {
    const { user } = open('/stocks/sample-hynix')
    expect(await screen.findByText('종목 선정 사유')).toBeInTheDocument()
    expect(screen.getByText(/10주 · 평균 200,000원/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '+ 오늘 기록하기' }))
    await user.type(screen.getByLabelText('몇 주'), '10')
    await user.clear(screen.getByLabelText('얼마에'))
    await user.type(screen.getByLabelText('얼마에'), '220000')
    expect(screen.getByText(/이제 20주, 평균 210,000원/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '더 싸져서' }))
    await user.click(screen.getByRole('button', { name: /불안/ }))
    await user.click(screen.getByRole('button', { name: '일지에 남기기' }))
    expect(await screen.findByText(/20주 · 평균 210,000원/)).toBeInTheDocument()
    expect(screen.getByText('10주 샀어요')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: '💬 한 줄 남기기' })[0])
    await user.click(screen.getByRole('button', { name: '🙏 목표 지키기' }))
    expect(await screen.findByText('🙏 목표 지키기')).toBeInTheDocument()
  })

  it('갖고 있는 것보다 많이 팔 수는 없다', async () => {
    const { user } = open('/stocks/sample-hynix')
    await user.click(await screen.findByRole('button', { name: '+ 오늘 기록하기' }))
    await user.click(screen.getByRole('button', { name: '팔았어요' }))
    await user.type(screen.getByLabelText('몇 주'), '11')
    await user.click(screen.getByRole('button', { name: '일지에 남기기' }))
    expect(screen.getByText(/지금 10주 있어요/)).toBeInTheDocument()
  })
})
