import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error('.env.local에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 설정해 주세요')
}

/**
 * 주소(#access_token=…)로 들어온 로그인을 받을지 (2026-11-26 보안 점검 확인 필요 3번).
 * 기본값은 '무조건 받기'라, 남이 만든 moabuli.com 링크를 누르면 지금 계정이 그 사람 계정으로 바뀌었다.
 * - 이 브라우저에서 10분 안에 구글 로그인을 시작했으면 받는다 (구글 로그인 돌아오는 길).
 * - 아직 아무 계정으로도 로그인돼 있지 않으면 받는다 (가입 확인 메일 등).
 * - 이미 로그인돼 있는데 시작한 적 없는 로그인이 주소로 들어오면 받지 않는다 — 바꿔치기를 막는다.
 */
export const OAUTH_PENDING_KEY = 'moabuli.oauthPending'
const OAUTH_WINDOW_MS = 10 * 60 * 1000

/** 구글 로그인(리디렉션)을 시작하기 직전에 부른다 */
export function markOAuthStart() {
  try {
    localStorage.setItem(OAUTH_PENDING_KEY, String(Date.now()))
  } catch {
    /* 저장이 막힌 브라우저 — 로그인이 안 된 상태라 아래 규칙으로도 받는다 */
  }
}

export function acceptUrlSession(params: { [k: string]: string }, now = Date.now()): boolean {
  const isCallback = Boolean(
    params.access_token || params.error || params.error_description || params.error_code,
  )
  if (!isCallback) return false
  let started = 0
  let signedIn = false
  try {
    started = Number(localStorage.getItem(OAUTH_PENDING_KEY)) || 0
    localStorage.removeItem(OAUTH_PENDING_KEY)
    signedIn = Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k))
  } catch {
    return false
  }
  if (now - started < OAUTH_WINDOW_MS || !signedIn) return true
  // 받지 않은 토큰은 주소에서 지운다 — 남겨 두면 화면 주소로 읽히고 기록에도 남는다
  try {
    history.replaceState(null, '', location.pathname + '#/')
  } catch {
    /* 주소를 못 바꿔도 로그인은 그대로 */
  }
  return false
}

export const supabase = createClient(url, anonKey, {
  auth: { detectSessionInUrl: (_url, params) => acceptUrlSession(params) },
})
