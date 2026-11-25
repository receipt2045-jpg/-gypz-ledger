/**
 * 메일 링크 처리 (2026-10-31). 메일 링크를 moabuli.com으로 바꿔야 앱이 바로 열린다.
 * Supabase 메일 템플릿: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup (재설정은 type=recovery)
 *
 * 2026-11-26 보안 점검(확인 필요 2번): 예전엔 링크를 열자마자 묻지 않고 그 링크의 계정으로 로그인을 바꿨다.
 * 남이 보낸 링크를 누르면 내 지출이 남의 가계부에 적힐 수 있었다.
 * 이제 이미 로그인돼 있으면 "다른 계정으로 바꿀까요?"를 먼저 묻는다.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type Step = 'checking' | 'ask' | 'verifying' | 'failed'

export default function AuthConfirm() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('checking')
  const [currentEmail, setCurrentEmail] = useState<string | null>(null)
  const token_hash = params.get('token_hash')
  const type = params.get('type') as EmailOtpType | null

  const verify = () => {
    if (!token_hash || !type) return setStep('failed')
    setStep('verifying')
    supabase.auth
      .verifyOtp({ token_hash, type })
      .then(({ error }) => {
        if (error) {
          console.error('메일 링크 확인 실패', error)
          setStep('failed')
        } else
          navigate(type === 'recovery' ? '/settings' : '/', {
            replace: true,
            // 재설정 링크면 설정의 새 비밀번호 칸을 바로 연다
            state: type === 'recovery' ? { resetPassword: true } : undefined,
          })
      })
      .catch((e: unknown) => {
        console.error('메일 링크 확인 실패', e)
        setStep('failed')
      })
  }

  useEffect(() => {
    if (!token_hash || !type) {
      setStep('failed')
      return
    }
    let alive = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return
        const user = data.session?.user
        if (user) {
          // 이미 로그인돼 있다 — 링크를 열면 계정이 바뀌니 먼저 묻는다
          setCurrentEmail(user.email ?? null)
          setStep('ask')
        } else verify()
      })
      .catch(() => alive && verify())
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token_hash, type])

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 text-center">
      {step === 'failed' ? (
        <div>
          <p className="text-[16px] font-bold text-ink">링크가 만료됐어요. 다시 요청해 주세요.</p>
          <button
            className="mt-4 text-brand underline"
            onClick={() => navigate('/', { replace: true })}
          >
            로그인 화면으로
          </button>
        </div>
      ) : step === 'ask' ? (
        <div className="w-full max-w-[340px]">
          <p className="text-[16px] font-bold text-ink">다른 계정의 메일 링크예요</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-sub">
            지금 {currentEmail ? <b className="text-ink">{currentEmail}</b> : '다른 계정'}(으)로
            로그인돼 있어요.
            <br />
            직접 요청한 메일 링크일 때만 계속해 주세요. 계속하면 링크의 계정으로 바뀌어요.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => navigate('/', { replace: true })}
              className="h-11 flex-1 rounded-btn bg-white text-[14px] font-bold text-sub shadow-card active:bg-line"
            >
              지금 계정 그대로
            </button>
            <button
              onClick={verify}
              className="h-11 flex-1 rounded-btn bg-brand text-[14px] font-bold text-white active:bg-brand-dark"
            >
              링크 계정으로 계속
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[15px] text-sub">확인하는 중이에요…</p>
      )}
    </div>
  )
}
