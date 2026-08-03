import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

// ── 유입 채널 기록 ─────────────────────────────
// 나눔 링크(?src=kakao / ?src=insta)로 들어온 사람이 가입까지 하면
// 어느 채널에서 왔는지 계정에 남긴다. 어떤 채널이 진짜 사용자를
// 데려오는지 보기 위한 것 — 이후 홍보를 어디에 집중할지 정하는 근거.

const KEY = 'moabuli_src'
const ALLOWED = /^[a-z0-9_-]{1,20}$/ // 링크에 붙는 값이라 형식을 좁게 제한

/**
 * 첫 방문 시 URL의 ?src= 값을 기억해 둔다 (앱 진입 시 1회 호출).
 * 가입은 나중에 일어나므로 localStorage에 보관했다가 가입 후 계정에 옮긴다.
 * 이미 기억한 값이 있으면 덮어쓰지 않는다 — 처음 데려온 채널이 기준.
 */
export function captureSource(): void {
  try {
    const src = new URLSearchParams(window.location.search).get('src')
    if (!src || !ALLOWED.test(src)) return
    if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, src)
  } catch {
    // 시크릿 모드 등 localStorage 불가 환경 — 추적은 포기해도 앱은 돌아야 한다
  }
}

/**
 * 로그인된 사용자의 계정에 유입 채널을 기록한다 (이메일 가입·구글 로그인 공통).
 * 이미 기록돼 있으면 건드리지 않는다. 실패해도 조용히 넘어간다.
 */
export async function attachSourceToUser(user: User): Promise<void> {
  try {
    const src = localStorage.getItem(KEY)
    if (!src) return
    if (user.user_metadata?.signupSrc) {
      localStorage.removeItem(KEY) // 이미 기록됨 — 더 들고 있을 이유 없음
      return
    }
    await supabase.auth.updateUser({ data: { signupSrc: src } })
    localStorage.removeItem(KEY)
  } catch {
    // 다음 로그인 때 다시 시도된다 (localStorage에 남아 있으므로)
  }
}
