import { useState } from 'react'
import { Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'

// OAuth 로그인 후 돌아올 주소 (배포 주소가 바뀌어도 자동 대응)
const redirectTo = window.location.origin + import.meta.env.BASE_URL

// Supabase 에러 메시지 → 한국어
function koError(message: string): string {
  if (message.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 맞지 않아요'
  if (message.includes('User already registered')) return '이미 가입된 이메일이에요. 로그인해 주세요'
  if (message.includes('Password should be at least')) return '비밀번호는 6자 이상이어야 해요'
  if (message.includes('rate limit') || message.includes('Rate limit'))
    return '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요'
  if (message.includes('Unable to validate email')) return '올바른 이메일 주소가 아니에요'
  return message
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = email.trim() && password.length >= 6 && !busy

  const signIn = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    if (err) setError(koError(err.message))
    // 성공하면 App의 onAuthStateChange가 화면을 전환함
  }

  const signUp = async () => {
    if (!canSubmit) return
    setBusy(true)
    setError('')
    setNotice('')
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: redirectTo },
    })
    setBusy(false)
    if (err) {
      setError(koError(err.message))
    } else if (data.user && !data.session) {
      // 이메일 확인이 켜져 있는 경우
      setNotice('확인 메일을 보냈어요. 메일의 링크를 누르면 가입이 완료돼요.')
    }
  }

  const loginWithGoogle = async () => {
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (err) setError(koError(err.message))
    // 성공하면 구글 로그인 페이지로 리디렉션됨
  }

  return (
    <div className="flex min-h-screen justify-center bg-[#e6e9ed]">
      <div className="flex min-h-screen w-full max-w-app flex-col justify-center bg-bg px-6 shadow-[0_0_60px_rgba(0,0,0,0.06)]">
        <div className="animate-fade-up">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10">
            <Wallet size={30} className="text-brand" />
          </div>
          <h1 className="text-[26px] font-extrabold leading-snug text-ink">우리집 가계부</h1>
          <p className="mt-2 text-[15px] font-medium leading-relaxed text-sub">
            매달 한 번, 부부가 함께 순자산을 키우는 가계부입니다 🤍
          </p>

          {/* 구글 로그인 */}
          <button
            onClick={loginWithGoogle}
            className="mt-7 flex h-13 w-full items-center justify-center gap-2.5 rounded-btn border border-line bg-white py-3.5 text-[15px] font-bold text-ink shadow-card active:bg-line"
          >
            <GoogleIcon />
            구글로 계속하기
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-[12px] text-cap">또는 이메일로</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          {/* 이메일 + 비밀번호 */}
          <div className="space-y-2.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일 주소"
              autoComplete="email"
              className="w-full rounded-btn border border-line bg-white px-4 py-3.5 text-[15px] text-ink outline-none focus:border-brand placeholder:text-cap"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && signIn()}
              placeholder="비밀번호 (6자 이상)"
              autoComplete="current-password"
              className="w-full rounded-btn border border-line bg-white px-4 py-3.5 text-[15px] text-ink outline-none focus:border-brand placeholder:text-cap"
            />
            <button
              onClick={signIn}
              disabled={!canSubmit}
              className="h-14 w-full rounded-btn bg-brand text-[16px] font-bold text-white shadow-cta active:bg-brand-dark disabled:opacity-40"
            >
              {busy ? '잠시만요…' : '로그인'}
            </button>
            <button
              onClick={signUp}
              disabled={!canSubmit}
              className="h-12 w-full rounded-btn bg-white text-[14px] font-semibold text-ink shadow-card active:bg-line disabled:opacity-40"
            >
              회원가입
            </button>
            {password.length > 0 && password.length < 6 && (
              <p className="text-[13px] text-cap">비밀번호를 6자 이상 입력하면 버튼이 활성화돼요</p>
            )}
            {error && <p className="text-[13px] text-danger">{error}</p>}
            {notice && <p className="text-[13px] text-brand">{notice}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}
