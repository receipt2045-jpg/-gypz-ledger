import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import SideIncome from './SideIncome'
import { renderScreen, seedStore } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'
import { currentYm, formatYmKorean } from '../lib/format'
import { resolveLedger } from '../lib/carryover'

// 둘러보기(householdId 없음) — 예시 부수입: 이번 달 들어온 돈 21만, 아낀 돈 26만 3천
const month = formatYmKorean(currentYm()).split(' ')[1]

function open() {
  seedStore({
    snapshots: [
      {
        ym: currentYm(),
        items: [
          {
            id: 'c1',
            kind: 'asset',
            group: 'cash',
            name: '토스 비상금',
            amount: 1_000_000,
            owner: '공동',
          },
          { id: 'h1', kind: 'asset', group: 'realestate', name: '전세보증금', amount: 300_000_000 },
        ],
      },
    ],
  })
  return renderScreen(<SideIncome />)
}

describe('부수입 가계부 (2026-11-19)', () => {
  it('이번 달 부수입을 들어온 돈·아낀 돈으로 나눠 보여 준다', async () => {
    open()
    expect(await screen.findByText('473,000원')).toBeInTheDocument()
    expect(screen.getAllByText('210,000원').length).toBeGreaterThan(0)
    expect(screen.getAllByText('263,000원').length).toBeGreaterThan(0)
  })

  it('들어온 돈을 적으면 합계가 늘어난다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    await user.click(screen.getByRole('button', { name: /부수입 적기/ }))
    await user.click(screen.getByRole('button', { name: '중고 판매' }))
    await user.type(screen.getByLabelText(/들어온 금액/), '20000')
    await user.click(screen.getByRole('button', { name: '적기' }))
    expect(await screen.findByText('493,000원')).toBeInTheDocument()
  })

  it('아낀 돈은 원래 값에서 낸 돈을 뺀다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    await user.click(screen.getByRole('button', { name: /부수입 적기/ }))
    await user.click(screen.getByRole('tab', { name: '아낀 돈' }))
    await user.type(screen.getByLabelText(/얼마짜리였나요/), '60000')
    await user.type(screen.getByLabelText(/내가 낸 돈/), '10000')
    expect(screen.getByText('아낀 돈 50,000원으로 적어요')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '적기' }))
    expect(await screen.findByText('523,000원')).toBeInTheDocument()
  })

  it('금액 없이 적으면 막는다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    await user.click(screen.getByRole('button', { name: /부수입 적기/ }))
    await user.click(screen.getByRole('button', { name: '적기' }))
    expect(screen.getByText('들어온 금액을 넣어 주세요')).toBeInTheDocument()
  })

  it('정산 — 통장과 살림으로 보내면 자산·가계부에 더하고, 마감을 풀면 되돌린다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    await user.click(screen.getByRole('button', { name: `${month} 부수입 정산하기` }))
    // 집·자동차 같은 건 보낼 곳에 안 나온다
    expect(screen.queryByText('전세보증금')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText(/토스 비상금에 보낼 돈/), '150000')
    await user.type(screen.getByLabelText(/살림에 보태기에 보낼 돈/), '60000')
    expect(screen.getByText('안 보낸 돈 0원')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: `${month} 부수입 마감` }))

    expect(await screen.findByText(`${month} 부수입 마감 ✅`)).toBeInTheDocument()
    const st = useLedgerStore.getState()
    expect(st.snapshots.find((s) => s.ym === currentYm())?.items[0].amount).toBe(1_150_000)
    const side = resolveLedger(st.ledgers, currentYm()).items.filter(
      (it) => it.group === 'income' && it.category === '부수입',
    )
    expect(side.reduce((a, it) => a + it.actual, 0)).toBe(60_000)

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: '마감 풀기' }))
    expect(
      await screen.findByRole('button', { name: `${month} 부수입 정산하기` }),
    ).toBeInTheDocument()
    const back = useLedgerStore.getState()
    expect(back.snapshots.find((s) => s.ym === currentYm())?.items[0].amount).toBe(1_000_000)
    expect(
      resolveLedger(back.ledgers, currentYm())
        .items.filter((it) => it.category === '부수입')
        .reduce((a, it) => a + it.actual, 0),
    ).toBe(0)
  })

  it('번 돈보다 많이 보내면 마감할 수 없다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    await user.click(screen.getByRole('button', { name: `${month} 부수입 정산하기` }))
    await user.type(screen.getByLabelText(/토스 비상금에 보낼 돈/), '300000')
    expect(screen.getByText('번 돈보다 90,000원 많아요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `${month} 부수입 마감` })).toBeDisabled()
  })
})
