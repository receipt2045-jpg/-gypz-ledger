import { useState } from 'react'
import { KeyRound, Send, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'

// 나중에 카카오/구글을 켜려면 이 배열에 추가만 하면 됨: ['kakao', 'google']
// (Supabase 대시보드 Authentication → Providers에서 해당 provider 설정 필요)
const ENABLED_OAUTH: ('kakao' | 'google')[] = []

const OAUTH_LABEL: Record<'kakao' | 'google', string> = {
  kakao: '카카오로 계속하기',
  google: '구글로 계속하기',
}

// 매직링크 클릭 후 돌아올 주소 (배포 주소가 바뀌어도 자동 대응)
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
  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
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

  const sendMagicLink = async () => {
    const trimmed = email.trim()
    if (!trimmed || busy) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo },
    })
    setBusy(false)
    if (err) setError(koError(err.message))
    else setSent(true)
  }

  const loginWithProvider = (provider: 'kakao' | 'google') =>
    supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })

  return (
    <div className="flex min-h-screen justify-center bg-[#e6e9ed]">
      <div className="flex min-h-screen w-full max-w-app flex-col justify-center bg-bg px-6 shadow-[0_0_60px_rgba(0,0,0,0.06)]">
        <div className="animate-fade-up">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10">
            <Wallet size={30} className="text-brand" />
          </div>
          <h1 className="text-[26px] font-extrabold leading-snug text-ink">우리집 가계부</h1>

          {mode === 'password' ? (
            <>
              <p className="mt-3 text-[15px] leading-relaxed text-sub">
                처음이면 이메일과 비밀번호를 정해서
                <br />
                <b className="text-ink">회원가입</b>을 눌러주세요.
              </p>
              <div className="mt-7 space-y-2.5">
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
                {error && <p className="text-[13px] text-danger">{error}</p>}
                {notice && <p className="text-[13px] text-brand">{notice}</p>}
              </div>
              <button
                onClick={() => {
                  setMode('magic')
                  setError('')
                }}
                className="mt-6 flex w-full items-center justify-center gap-1.5 text-[13px] text-cap underline"
              >
                <KeyRound size={13} /> 비밀번호 대신 이메일 링크로 로그인
              </button>
            </>
          ) : (
            <>
              {sent ? (
                <>
                  <p className="mt-3 text-[15px] leading-relaxed text-sub">
                    <b className="text-ink">{email.trim()}</b> 으로
                    <br />
                    로그인 링크를 보냈어요. 메일함을 확인해 주세요!
                  </p>
                  <p className="mt-2 text-[13px] text-cap">
                    메일이 안 보이면 스팸함도 확인해 보세요.
                  </p>
                  <button
                    onClick={() => setSent(false)}
                    className="mt-6 h-12 w-full rounded-btn bg-bg text-[14px] font-semibold text-sub active:bg-line"
                  >
                    다시 보내기
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-3 text-[15px] leading-relaxed text-sub">
                    이메일로 로그인 링크를 보내드려요.
                    <br />
                    (발송량 제한이 있어 메일이 늦을 수 있어요)
                  </p>
                  <div className="mt-7 space-y-2.5">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMagicLink()}
                      placeholder="이메일 주소"
                      autoComplete="email"
                      className="w-full rounded-btn border border-line bg-white px-4 py-3.5 text-[15px] text-ink outline-none focus:border-brand placeholder:text-cap"
                    />
                    <button
                      onClick={sendMagicLink}
                      disabled={busy || !email.trim()}
                      className="flex h-14 w-full items-center justify-center gap-2 rounded-btn bg-brand text-[16px] font-bold text-white shadow-cta active:bg-brand-dark disabled:opacity-40"
                    >
                      <Send size={17} />
                      {busy ? '보내는 중…' : '로그인 링크 받기'}
                    </button>
                    {error && <p className="text-[13px] text-danger">{error}</p>}
                  </div>
                </>
              )}
              <button
                onClick={() => {
                  setMode('password')
                  setSent(false)
                  setError('')
                }}
                className="mt-6 w-full text-center text-[13px] text-cap underline"
              >
                비밀번호로 로그인
              </button>
            </>
          )}

          {ENABLED_OAUTH.length > 0 && (
            <div className="mt-6 space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-line" />
                <span className="text-[12px] text-cap">또는</span>
                <div className="h-px flex-1 bg-line" />
              </div>
              {ENABLED_OAUTH.map((p) => (
                <button
                  key={p}
                  onClick={() => loginWithProvider(p)}
                  className="h-12 w-full rounded-btn bg-white text-[14px] font-semibold text-ink shadow-card active:bg-line"
                >
                  {OAUTH_LABEL[p]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
