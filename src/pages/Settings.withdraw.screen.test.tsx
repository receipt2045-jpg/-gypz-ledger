import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import Settings from './Settings'
import { renderScreen, seedStore } from '../test/renderScreen'

const h = vi.hoisted(() => ({
  order: [] as string[],
  deleteMyPushData: vi.fn(),
  deleteMyAccount: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      signOut: () => h.signOut(),
    },
  },
}))
vi.mock('../lib/db', async (orig) => ({
  ...(await orig<typeof import('../lib/db')>()),
  fetchMemberCount: vi.fn().mockResolvedValue(2),
  deleteMyAccount: () => h.deleteMyAccount(),
}))
vi.mock('../lib/pushPrefs', async (orig) => ({
  ...(await orig<typeof import('../lib/pushPrefs')>()),
  deleteMyPushData: () => h.deleteMyPushData(),
}))

// 웹(isNative=false)에서도 탈퇴 때 서버의 푸시 데이터를 지운다 — 웹에서 탈퇴해도 폰에 토큰이 남아 있을 수 있다
describe('설정 — 회원 탈퇴와 푸시 데이터', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    h.order = []
    h.deleteMyPushData.mockImplementation(async () => void h.order.push('push'))
    h.deleteMyAccount.mockImplementation(async () => void h.order.push('account'))
    h.signOut.mockImplementation(async () => void h.order.push('signOut'))
    seedStore({})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  it('웹에서도 계정 삭제 전에 푸시 데이터를 먼저 지운다', async () => {
    const { user } = renderScreen(<Settings />)
    await user.click(await screen.findByRole('button', { name: /회원 탈퇴/ }))
    await waitFor(() => expect(h.order).toEqual(['push', 'account', 'signOut']))
  })

  it('푸시 데이터 삭제가 실패해도 탈퇴는 계속된다', async () => {
    h.deleteMyPushData.mockRejectedValue(new Error('rpc 없음'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { user } = renderScreen(<Settings />)
    await user.click(await screen.findByRole('button', { name: /회원 탈퇴/ }))
    await waitFor(() => expect(h.deleteMyAccount).toHaveBeenCalled())
    expect(h.signOut).toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
  })

  it('로그아웃 버튼도 공통 로그아웃을 쓴다', async () => {
    const { user } = renderScreen(<Settings />)
    await user.click(await screen.findByRole('button', { name: /로그아웃/ }))
    await waitFor(() => expect(h.signOut).toHaveBeenCalled())
  })
})
