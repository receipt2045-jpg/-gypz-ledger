// ── 로그인 전 둘러보기 (2026-10-23) ──
// 처음 온 사람은 로그인 화면 대신 예시 가계부부터 본다. 써 보고 싶어지면 '우리 부부 가계부 만들기'로 가입.
// 한 번 가입·로그인했거나 시작하기를 누른 기기는 다음부터 로그인 화면으로 바로 간다
// (구글에서 돌아오다 취소했거나, 인증 메일을 기다리는 사람이 예시로 다시 떨어지지 않게).
import { codeFromHash, pendingInvite } from './invite'

const LOGIN_KEY = 'moabuli.showLogin'

/** 로그인 화면부터 보여줄지 — 초대 링크로 왔거나, 이 기기에서 시작하기·로그인을 해 봤으면 */
export function startsAtLogin(): boolean {
  if (codeFromHash(window.location.hash) || pendingInvite()) return true
  try {
    return localStorage.getItem(LOGIN_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberLogin(on: boolean) {
  try {
    if (on) localStorage.setItem(LOGIN_KEY, '1')
    else localStorage.removeItem(LOGIN_KEY)
  } catch {
    // 저장이 막힌 브라우저 — 다음에도 예시부터 보일 뿐이다
  }
}
