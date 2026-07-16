import { useState } from 'react'
import { Mail, Send } from 'lucide-react'
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

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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
    if (err) setError(err.message)
    else setSent(true)
  }

  const loginWithProvider = (provider: 'kakao' | 'google') =>
    supabase.auth.signInWithOAuth({ provider, options: { redirectTo } })

  return (
    <div className="flex min-h-screen justify-center bg-[#e6e9ed]">
      <div className="flex min-h-screen w-full max-w-app flex-col justify-center bg-bg px-6 shadow-[0_0_60px_rgba(0,0,0,0.06)]">
        <div className="animate-fade-up">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10">
            <Mail size={30} className="text-brand" />
          </div>
          <h1 className="text-[26px] font-extrabold leading-snug text-ink">
            우리집 가계부
          </h1>

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
                다른 이메일로 다시 보내기
              </button>
            </>
          ) : (
            <>
              <p className="mt-3 text-[15px] leading-relaxed text-sub">
                이메일을 입력하면 로그인 링크를 보내드려요.
                <br />
                비밀번호는 필요 없어요.
              </p>
              <div className="mt-7 space-y-2.5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMagicLink()}
                  placeholder="이메일 주소"
                  autoComplete="email"
                  className="h-13 w-full rounded-btn border border-line bg-white px-4 py-3.5 text-[15px] text-ink outline-none focus:border-brand placeholder:text-cap"
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
