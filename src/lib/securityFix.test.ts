import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OAUTH_PENDING_KEY, acceptUrlSession, markOAuthStart } from './supabase'

// 2026-11-26 보안 점검 고치기 — 주소로 들어온 로그인(#access_token)을 받을지
describe('acceptUrlSession — 로그인 바꿔치기 막기', () => {
  const tokens = { access_token: 'x', refresh_token: 'y' }
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('로그인 정보가 없는 주소는 로그인 주소로 보지 않는다', () => {
    expect(acceptUrlSession({})).toBe(false)
  })

  it('아직 로그인 안 된 브라우저면 받는다 (가입 확인 메일 등)', () => {
    expect(acceptUrlSession(tokens)).toBe(true)
  })

  it('이미 로그인돼 있고 시작한 적 없는 로그인이면 받지 않는다', () => {
    localStorage.setItem('sb-proj-auth-token', '{}')
    expect(acceptUrlSession(tokens)).toBe(false)
  })

  it('이 브라우저에서 방금 구글 로그인을 시작했으면 받고, 표시는 한 번만 쓴다', () => {
    localStorage.setItem('sb-proj-auth-token', '{}')
    markOAuthStart()
    expect(acceptUrlSession(tokens)).toBe(true)
    expect(localStorage.getItem(OAUTH_PENDING_KEY)).toBeNull()
    expect(acceptUrlSession(tokens)).toBe(false)
  })

  it('구글 로그인을 시작한 지 10분이 넘었으면 받지 않는다', () => {
    localStorage.setItem('sb-proj-auth-token', '{}')
    localStorage.setItem(OAUTH_PENDING_KEY, String(Date.now() - 11 * 60 * 1000))
    expect(acceptUrlSession(tokens)).toBe(false)
  })
})

describe('초대 코드 — 서버가 빈 결과를 주면 틀린 코드', () => {
  it('join/switch 모두 "초대 코드를 찾을 수 없어요"', async () => {
    vi.resetModules()
    vi.doMock('./supabase', () => ({
      supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) },
    }))
    const db = await import('./db')
    await expect(db.joinHousehold('ABCD1234')).rejects.toThrow('초대 코드를 찾을 수 없어요')
    await expect(db.switchHousehold('ABCD1234')).rejects.toThrow('초대 코드를 찾을 수 없어요')
    vi.doUnmock('./supabase')
  })
})
