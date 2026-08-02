import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import Confess from './Confess'
import { renderScreen, seedStore } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'
import { NO_SPEND } from '../lib/constants'

const saved = () => useLedgerStore.getState().confessions

function openConfess() {
  seedStore({})
  return renderScreen(<Confess />)
}

/** 줄글을 적고 '확인하기 → n건 고백하기'까지 */
async function confessText(user: ReturnType<typeof openConfess>['user'], text: string) {
  await user.type(screen.getByRole('textbox'), text)
  await user.click(screen.getByRole('button', { name: '확인하기' }))
  await user.click(screen.getByRole('button', { name: /건 고백하기/ }))
}

describe('고백 화면 — 기록', () => {
  it('한 건을 말하면 그대로 저장된다', async () => {
    const { user } = openConfess()
    await confessText(user, '점심 9000원')

    expect(saved()).toHaveLength(1)
    expect(saved()[0].amount).toBe(9_000)
  })

  // 제보 재현: "점심 9,000원, 커피 5,500원이라고 하니 커피가 설명으로 들어가요"
  it('한 번에 두 건을 말하면 두 건 다 저장된다', async () => {
    const { user } = openConfess()
    await confessText(user, '점심 9000원, 커피 5500원')

    expect(saved().map((c) => c.amount).sort((a, b) => a - b)).toEqual([5_500, 9_000])
  })

  it('무지출 버튼은 0원으로 기록된다', async () => {
    const { user } = openConfess()
    await user.click(screen.getByRole('button', { name: /안 썼어요/ }))

    expect(saved()).toHaveLength(1)
    expect(saved()[0]).toMatchObject({ category: NO_SPEND, amount: 0 })
  })

  it('금액이 없으면 저장하지 않고 알려준다', async () => {
    const { user } = openConfess()
    await user.type(screen.getByRole('textbox'), '오늘 그냥 그랬어')
    await user.click(screen.getByRole('button', { name: '확인하기' }))

    expect(screen.getByText(/금액을 찾지 못했어요/)).toBeInTheDocument()
    expect(saved()).toHaveLength(0)
  })

  it('오늘 이미 기록했으면 무지출 버튼이 사라진다', async () => {
    const { user } = openConfess()
    expect(screen.getByRole('button', { name: /안 썼어요/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /안 썼어요/ }))

    expect(screen.queryByRole('button', { name: /안 썼어요/ })).not.toBeInTheDocument()
  })
})
