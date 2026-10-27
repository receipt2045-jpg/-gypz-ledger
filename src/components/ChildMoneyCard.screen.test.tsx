import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import ChildMoneyCard from './ChildMoneyCard'
import { renderScreen, seedStore } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'

function open() {
  seedStore({ memberNo: 1, confessions: [] })
  useLedgerStore.setState((s) => ({
    profile: { ...s.profile, childNames: ['찰떡이'] },
    categories: {
      ...s.categories,
      income: ['주수입', '부수입', '투자수익', '아동수당·지원금', '용돈·선물', '기타'],
    },
  }))
  return renderScreen(<ChildMoneyCard childAssets={{}} />)
}

describe('아이 통장 카드에서 들어온 돈 바로 적기 (2026-10-27)', () => {
  it('아동수당 — 기본은 증여 아님, 아이 통장으로 받았으면 체크해서 증여에 넣는다', async () => {
    const { user } = open()
    await user.click(screen.getByRole('button', { name: /찰떡이 앞으로 들어온 돈 적기/ }))
    await user.type(screen.getByLabelText('들어온 금액'), '100000')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '적기' }))
    const saved = useLedgerStore.getState().confessions[0]
    expect(saved).toMatchObject({
      kind: 'income',
      category: '아동수당·지원금',
      amount: 100_000,
      child: '찰떡이',
      childKeep: true,
      gift: true,
    })
    // 카드에 바로 보인다
    expect(await screen.findByText('+10만원')).toBeInTheDocument()
  })

  it('용돈·선물 — 기본으로 증여, 살림에 보태요', async () => {
    const { user } = open()
    await user.click(screen.getByRole('button', { name: /찰떡이 앞으로 들어온 돈 적기/ }))
    await user.click(screen.getByRole('button', { name: '용돈·선물' }))
    await user.type(screen.getByLabelText('들어온 금액'), '50000')
    await user.click(screen.getByRole('button', { name: '살림에 보태요' }))
    expect(screen.getByRole('checkbox')).toBeChecked()
    await user.click(screen.getByRole('button', { name: '적기' }))
    expect(useLedgerStore.getState().confessions[0]).toMatchObject({
      category: '용돈·선물',
      gift: true,
      childKeep: false,
    })
  })
})
