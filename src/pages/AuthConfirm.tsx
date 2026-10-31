/**
 * 메일 링크 처리 (2026-10-31). 메일 링크를 moabuli.com으로 바꿔야 앱이 바로 열린다.
 * Supabase 메일 템플릿: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup (재설정은 type=recovery)
 */
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export default function AuthConfirm() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const token_hash = params.get('token_hash')
    const type = params.get('type') as EmailOtpType | null
    if (!token_hash || !type) {
      setFailed(true)
      return
    }
    supabase.auth
      .verifyOtp({ token_hash, type })
      .then(({ error }) => {
        if (error) {
          console.error('메일 링크 확인 실패', error)
          setFailed(true)
        } else navigate(type === 'recovery' ? '/settings' : '/', { replace: true })
      })
      .catch((e: unknown) => {
        console.error('메일 링크 확인 실패', e)
        setFailed(true)
      })
  }, [params, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 text-center">
      {failed ? (
        <div>
          <p className="text-[16px] font-bold text-ink">링크가 만료됐어요. 다시 요청해 주세요.</p>
          <button className="mt-4 text-brand underline" onClick={() => navigate('/', { replace: true })}>
            로그인 화면으로
          </button>
        </div>
      ) : (
        <p className="text-[15px] text-sub">확인하는 중이에요…</p>
      )}
    </div>
  )
}
