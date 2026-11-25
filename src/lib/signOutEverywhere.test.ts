import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ order: [] as string[], forget: vi.fn(), signOut: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { auth: { signOut: () => h.signOut() } } }))
vi.mock('./pushNative', () => ({ forgetPushToken: () => h.forget() }))

import { signOutEverywhere } from './db'

beforeEach(() => {
  h.order = []
  h.forget.mockImplementation(async () => void h.order.push('forget'))
  h.signOut.mockImplementation(async () => void h.order.push('signOut'))
})

describe('signOutEverywhere (모든 로그아웃 경로 공통)', () => {
  it('토큰을 먼저 지우고 로그아웃한다', async () => {
    await signOutEverywhere()
    expect(h.order).toEqual(['forget', 'signOut'])
  })
  it('토큰 지우기가 던져도 로그아웃은 된다', async () => {
    h.forget.mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await signOutEverywhere()
    expect(h.signOut).toHaveBeenCalled()
  })
})
