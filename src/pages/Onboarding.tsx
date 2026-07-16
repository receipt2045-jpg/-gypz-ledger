import { useState } from 'react'
import { Heart, KeyRound, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { createHousehold, joinHousehold, type Membership } from '../lib/db'

export default function Onboarding({ onDone }: { onDone: (m: Membership) => void }) {
  const [mode, setMode] = useState<'choose' | 'join'>('choose')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      onDone(await createHousehold())
    } catch (err) {
      setError(err instanceof Error ? err.message : '가계부를 만들지 못했어요')
      setBusy(false)
    }
  }

  const handleJoin = async () => {
    if (busy || !code.trim()) return
    setBusy(true)
    setError('')
    try {
      onDone(await joinHousehold(code))
    } catch (err) {
      setError(err instanceof Error ? err.message : '참여하지 못했어요')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen justify-center bg-[#e6e9ed]">
      <div className="flex min-h-screen w-full max-w-app flex-col justify-center bg-bg px-6 shadow-[0_0_60px_rgba(0,0,0,0.06)]">
        <div className="animate-fade-up">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10">
            <Heart size={30} className="text-brand" />
          </div>
          <h1 className="text-[26px] font-extrabold leading-snug text-ink">
            거의 다 됐어요!
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-sub">
            부부가 함께 쓰는 가계부예요.
            <br />
            새로 만들거나, 배우자의 초대 코드로 참여하세요.
          </p>

          {mode === 'choose' ? (
            <div className="mt-8 space-y-3">
              <button
                onClick={handleCreate}
                disabled={busy}
                className="flex w-full items-center gap-4 rounded-card bg-card px-5 py-5 text-left shadow-card transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Plus size={22} />
                </div>
                <div>
                  <p className="text-[16px] font-bold text-ink">
                    {busy ? '만드는 중…' : '새 가계부 만들기'}
                  </p>
                  <p className="mt-0.5 text-[13px] text-sub">
                    내가 먼저 시작하고 배우자를 초대해요
                  </p>
                </div>
              </button>
              <button
                onClick={() => {
                  setMode('join')
                  setError('')
                }}
                className="flex w-full items-center gap-4 rounded-card bg-card px-5 py-5 text-left shadow-card transition-transform active:scale-[0.98]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-500">
                  <KeyRound size={22} />
                </div>
                <div>
                  <p className="text-[16px] font-bold text-ink">초대 코드로 참여하기</p>
                  <p className="mt-0.5 text-[13px] text-sub">
                    배우자에게 받은 8자리 코드를 입력해요
                  </p>
                </div>
              </button>
            </div>
          ) : (
            <div className="mt-8 space-y-2.5">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="초대 코드 (예: 3F2A9C1B)"
                maxLength={8}
                className="w-full rounded-btn border border-line bg-white px-4 py-3.5 text-center text-[18px] font-bold tracking-[0.3em] text-ink outline-none focus:border-brand placeholder:text-[14px] placeholder:font-normal placeholder:tracking-normal placeholder:text-cap"
              />
              <button
                onClick={handleJoin}
                disabled={busy || code.trim().length < 8}
                className="h-14 w-full rounded-btn bg-brand text-[16px] font-bold text-white shadow-cta active:bg-brand-dark disabled:opacity-40"
              >
                {busy ? '연결 중…' : '참여하기'}
              </button>
              <button
                onClick={() => {
                  setMode('choose')
                  setError('')
                }}
                className="h-11 w-full rounded-btn bg-bg text-[14px] font-semibold text-sub active:bg-line"
              >
                뒤로
              </button>
            </div>
          )}

          {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

          <button
            onClick={() => supabase.auth.signOut()}
            className="mt-8 w-full text-center text-[13px] text-cap underline"
          >
            다른 계정으로 로그인
          </button>
        </div>
      </div>
    </div>
  )
}
