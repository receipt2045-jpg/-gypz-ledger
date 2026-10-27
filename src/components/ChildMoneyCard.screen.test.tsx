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

  it('용돈·선물 — 기본으로 증여, 살림에 보태면 증여 체크칸이 사라지고 증여로 안 센다', async () => {
    const { user } = open()
    await user.click(screen.getByRole('button', { name: /찰떡이 앞으로 들어온 돈 적기/ }))
    await user.click(screen.getByRole('button', { name: '용돈·선물' }))
    await user.type(screen.getByLabelText('들어온 금액'), '50000')
    expect(screen.getByRole('checkbox')).toBeChecked()
    await user.click(screen.getByRole('button', { name: '살림에 보태요' }))
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '적기' }))
    const saved = useLedgerStore.getState().confessions[0]
    expect(saved).toMatchObject({ category: '용돈·선물', childKeep: false })
    expect(saved.gift).toBeUndefined()
  })

  it('증여로 적은 돈을 신고했다고 남기면 아직 안 한 돈이 줄어든다', async () => {
    const { user } = open()
    await user.click(screen.getByRole('button', { name: /찰떡이 앞으로 들어온 돈 적기/ }))
    await user.click(screen.getByRole('button', { name: '용돈·선물' }))
    await user.type(screen.getByLabelText('들어온 금액'), '3000000')
    await user.click(screen.getByRole('button', { name: '적기' }))
    expect(await screen.findByText('아직 안 한 돈 300만원')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '증여 신고했어요' }))
    // 아직 안 한 돈이 미리 채워진다
    expect(screen.getByLabelText('신고한 금액')).toHaveValue('3,000,000')
    await user.click(screen.getByRole('button', { name: '신고 기록 남기기' }))
    expect(await screen.findByText('기록한 증여는 다 신고했어요')).toBeInTheDocument()
    expect(screen.getByText('한 번에 신고')).toBeInTheDocument()
  })
})
