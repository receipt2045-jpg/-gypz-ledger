/**
 * 구글 로그인 (2026-10-31). 앱 웹뷰 안에서는 구글이 웹 로그인 화면을 막는다.
 * 앱은 폰의 구글 계정 선택 창 → ID 토큰 → Supabase, 웹은 예전처럼 리디렉션.
 */
import { isNative } from './native'
import { supabase } from './supabase'

let ready: Promise<void> | null = null

/** 계정 선택 창을 사용자가 닫았을 때 플러그인이 던지는 오류 (code === 'USER_CANCELLED') */
const userCancelled = (err: unknown) => (err as { code?: string } | null)?.code === 'USER_CANCELLED'

export async function loginWithGoogle(redirectTo: string): Promise<{ error: string | null }> {
  if (!isNative()) {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    return { error: error?.message ?? null }
  }
  const webClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID
  if (!webClientId) return { error: '구글 로그인을 준비 중이에요. 이메일로 로그인해 주세요.' }
  let idToken: string | null | undefined
  try {
    // 웹 사용자에게는 플러그인 코드(와 그 부작용)가 로드되지 않도록 앱에서만 불러온다
    const { SocialLogin } = await import('@capgo/capacitor-social-login')
    ready ??= SocialLogin.initialize({ google: { webClientId } })
    await ready
    const res = await SocialLogin.login({ provider: 'google', options: {} })
    idToken = (res.result as { idToken?: string | null }).idToken
  } catch (err) {
    ready = null // 초기화가 실패했다면 다음에 다시 시도
    if (userCancelled(err)) return { error: null } // 창을 닫은 것
    console.error('구글 로그인 실패', err)
    return { error: '구글 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.' }
  }
  if (!idToken) return { error: '구글 로그인 정보를 받지 못했어요.' }
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })
  return { error: error?.message ?? null }
}
