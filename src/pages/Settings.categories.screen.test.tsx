import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import Settings from './Settings'
import { renderScreen, seedStore } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } },
}))

describe('설정 — 카테고리 추가가 안 되면 이유를 보여준다 (2026-10-07 제보)', () => {
  it('다른 칸에 같은 이름이 있으면 어디에 있는지 알려 주고 입력은 남겨 둔다', async () => {
    seedStore({})
    const income = useLedgerStore.getState().categories.income[0]
    const { user } = renderScreen(<Settings />)
    const inputs = screen.getAllByPlaceholderText('새 카테고리')
    const variableInput = inputs[inputs.length - 1]
    await user.type(variableInput, `${income}{Enter}`)
    expect(screen.getByText(new RegExp(`'${income}'은 이미 .*에 있어요`))).toBeInTheDocument()
    expect(variableInput).toHaveValue(income)
  })

  it('새 이름은 추가되고 입력칸이 비워진다', async () => {
    seedStore({})
    const { user } = renderScreen(<Settings />)
    const inputs = screen.getAllByPlaceholderText('새 카테고리')
    const variableInput = inputs[inputs.length - 1]
    await user.type(variableInput, '반려동물{Enter}')
    expect(useLedgerStore.getState().categories.variable).toContain('반려동물')
    expect(variableInput).toHaveValue('')
  })
})
