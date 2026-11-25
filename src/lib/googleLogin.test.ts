import { beforeEach, describe, expect, it, vi } from 'vitest'
const native = vi.fn(() => false)
vi.mock('./native', () => ({ isNative: () => native() }))
const signInWithOAuth = vi.fn(async (_o: unknown) => ({ error: null }))
const signInWithIdToken = vi.fn(async (_o: unknown) => ({ error: null }))
vi.mock('./supabase', () => ({
  supabase: { auth: { signInWithOAuth: (o: unknown) => signInWithOAuth(o), signInWithIdToken: (o: unknown) => signInWithIdToken(o) } },
}))
const initialize = vi.fn(async (_o: unknown) => {})
const login = vi.fn(async (_o: unknown) => ({ result: { idToken: 'ID.TOKEN' } }))
vi.mock('@capgo/capacitor-social-login', () => ({
  SocialLogin: { initialize: (o: unknown) => initialize(o), login: (o: unknown) => login(o) },
}))
import { loginWithGoogle } from './googleLogin'

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  native.mockReturnValue(false)
})

describe('loginWithGoogle', () => {
  it('웹은 예전처럼 구글 페이지로 보낸다 (웹 클라이언트 ID 없이도)', async () => {
    vi.stubEnv('VITE_GOOGLE_WEB_CLIENT_ID', '')
    await loginWithGoogle('https://moabuli.com/')
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'https://moabuli.com/' } })
    expect(initialize).not.toHaveBeenCalled()
  })

  it('앱은 폰의 구글 계정으로 받은 토큰으로 로그인한다', async () => {
    vi.stubEnv('VITE_GOOGLE_WEB_CLIENT_ID', 'web-id.apps.googleusercontent.com')
    native.mockReturnValue(true)
    expect(await loginWithGoogle('x')).toEqual({ error: null })
    expect(initialize).toHaveBeenCalledWith({ google: { webClientId: 'web-id.apps.googleusercontent.com' } })
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'ID.TOKEN' })
  })

  it('앱에서 계정 선택 창을 닫으면 에러 없이 끝낸다', async () => {
    vi.stubEnv('VITE_GOOGLE_WEB_CLIENT_ID', 'web-id')
    native.mockReturnValue(true)
    login.mockRejectedValueOnce(Object.assign(new Error('User cancelled'), { code: 'USER_CANCELLED' }))
    expect(await loginWithGoogle('x')).toEqual({ error: null })
    expect(signInWithIdToken).not.toHaveBeenCalled()
  })

  it('앱에서 진짜 실패하면 안내 문구를 돌려주고 원인을 남긴다', async () => {
    vi.stubEnv('VITE_GOOGLE_WEB_CLIENT_ID', 'web-id')
    native.mockReturnValue(true)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    login.mockRejectedValueOnce(new Error('boom'))
    const res = await loginWithGoogle('x')
    expect(res.error).toBe('구글 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.')
    expect(spy).toHaveBeenCalled()
    expect(signInWithIdToken).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('앱에서 웹 클라이언트 ID가 없으면 플러그인을 부르지 않고 안내한다', async () => {
    vi.stubEnv('VITE_GOOGLE_WEB_CLIENT_ID', '')
    native.mockReturnValue(true)
    const res = await loginWithGoogle('x')
    expect(res.error).toBe('구글 로그인을 준비 중이에요. 이메일로 로그인해 주세요.')
    expect(initialize).not.toHaveBeenCalled()
    expect(login).not.toHaveBeenCalled()
  })
})
