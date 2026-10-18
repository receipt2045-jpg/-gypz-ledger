import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import Settings from './Settings'
import { renderScreen, seedStore } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'
import * as db from '../lib/db'

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } },
}))

// 제보(2026-10-18): 남편이 초대 링크로 가입했는데 '새로 만들기'로 따로 가계부가 생겨 아내 가계부로 못 들어갔다
describe('설정 — 배우자 가계부로 옮기기', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    seedStore({})
    useLedgerStore.setState({ householdId: 'mine' })
  })

  it('혼자 쓰는 사람에게만 보이고, 코드를 넣고 확인하면 옮긴다', async () => {
    vi.spyOn(db, 'fetchMemberCount').mockResolvedValue(1)
    const sw = vi.spyOn(db, 'switchHousehold').mockResolvedValue()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const reload = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload })

    const { user } = renderScreen(<Settings />)
    await user.click(await screen.findByText('배우자가 먼저 시작했나요?'))
    await user.type(screen.getByLabelText('배우자 초대 코드'), 'a1b2c3d4')
    await user.click(screen.getByRole('button', { name: '배우자 가계부로 옮기기' }))

    expect(sw).toHaveBeenCalledWith('A1B2C3D4')
    expect(reload).toHaveBeenCalled()
  })

  it('이미 둘이 쓰는 가계부면 보이지 않는다', async () => {
    vi.spyOn(db, 'fetchMemberCount').mockResolvedValue(2)
    renderScreen(<Settings />)
    await screen.findByText('부부 연결')
    expect(screen.queryByText('배우자가 먼저 시작했나요?')).not.toBeInTheDocument()
  })
})
