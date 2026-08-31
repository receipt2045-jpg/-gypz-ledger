import { useState } from 'react'
import { Heart, KeyRound, Plus, Target } from 'lucide-react'
import AmountInput from '../components/AmountInput'
import { supabase } from '../lib/supabase'
import { createHousehold, joinHousehold, pushProfile, type Membership } from '../lib/db'
import { abbreviateKRW } from '../lib/format'
import { clearPendingInvite, pendingInvite } from '../lib/invite'

export default function Onboarding({ onDone }: { onDone: (m: Membership) => void }) {
  const [mode, setMode] = useState<'choose' | 'join' | 'profile'>('choose')
  // 초대 링크로 온 사람 — 코드는 이미 챙겨 뒀다. 받아 적을 필요가 없다.
  const [invited, setInvited] = useState(() => pendingInvite())
  const [code, setCode] = useState(() => pendingInvite() ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // 가구 생성 직후 이름·목표 설정 (브리프 P2 3.2)
  const [membership, setMembership] = useState<Membership | null>(null)
  const [name1, setName1] = useState('남편')
  const [name2, setName2] = useState('아내')
  const [target, setTarget] = useState(1_000_000_000)

  const handleCreate = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      clearPendingInvite() // 초대를 안 쓰기로 했으면 더 들고 있지 않는다
      const m = await createHousehold()
      setMembership(m)
      setBusy(false)
      setMode('profile')
    } catch (err) {
      setError(err instanceof Error ? err.message : '가계부를 만들지 못했어요')
      setBusy(false)
    }
  }

  const saveProfile = async () => {
    if (!membership || busy) return
    setBusy(true)
    try {
      await pushProfile(membership.householdId, {
        member1Name: name1.trim() || '남편',
        member2Name: name2.trim() || '아내',
        targetNetWorth: target > 0 ? target : 1_000_000_000,
        startYear: new Date().getFullYear(),
      })
    } catch (err) {
      console.error(err) // 저장 실패해도 기본값으로 진행 (설정에서 수정 가능)
    }
    onDone(membership)
  }

  const handleJoin = async () => {
    if (busy || !code.trim()) return
    setBusy(true)
    setError('')
    try {
      const m = await joinHousehold(code)
      clearPendingInvite()
      onDone(m)
    } catch (err) {
      setError(err instanceof Error ? err.message : '참여하지 못했어요')
      setBusy(false)
    }
  }

  /** 초대 링크가 안 맞을 때(코드 만료·이미 두 명) 일반 화면으로 돌아간다. */
  const dropInvite = () => {
    clearPendingInvite()
    setInvited(null)
    setCode('')
    setError('')
  }

  return (
    <div className="flex min-h-screen justify-center bg-[#e6e9ed]">
      <div className="flex min-h-screen w-full max-w-app flex-col justify-center bg-bg px-6 shadow-[0_0_60px_rgba(0,0,0,0.06)]">
        <div className="animate-fade-up">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10">
            {mode === 'profile' ? (
              <Target size={30} className="text-brand" />
            ) : (
              <Heart size={30} className="text-brand" />
            )}
          </div>
          <h1 className="text-[26px] font-extrabold leading-snug text-ink">
            {mode === 'profile'
              ? '우리 부부를 알려주세요'
              : invited
                ? '초대를 받으셨네요!'
                : '거의 다 됐어요!'}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-sub">
            {mode === 'profile' ? (
              <>
                호칭과 10년 목표 순자산을 정해요.
                <br />
                나중에 설정에서 언제든 바꿀 수 있어요.
              </>
            ) : invited ? (
              <>
                배우자가 만든 가계부에 참여합니다.
                <br />
                버튼 한 번이면 끝이에요.
              </>
            ) : (
              <>
                부부가 함께 쓰는 가계부예요.
                <br />
                새로 만들거나, 배우자의 초대 코드로 참여하세요.
              </>
            )}
          </p>

          {mode === 'profile' ? (
            <div className="mt-8 space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="mb-1.5 block text-[13px] font-medium text-sub">나 (구성원 1)</label>
                  <input
                    type="text"
                    value={name1}
                    onChange={(e) => setName1(e.target.value)}
                    className="w-full rounded-btn border border-line bg-white px-3.5 py-3 text-center text-[15px] font-semibold text-ink outline-none focus:border-brand"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1.5 block text-[13px] font-medium text-sub">배우자 (구성원 2)</label>
                  <input
                    type="text"
                    value={name2}
                    onChange={(e) => setName2(e.target.value)}
                    className="w-full rounded-btn border border-line bg-white px-3.5 py-3 text-center text-[15px] font-semibold text-ink outline-none focus:border-brand"
                  />
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-[13px] font-medium text-sub">10년 목표 순자산</label>
                  <span className="text-[12px] text-cap">{abbreviateKRW(target)}</span>
                </div>
                <AmountInput value={target} onChange={setTarget} />
              </div>
              <button
                onClick={saveProfile}
                disabled={busy}
                className="h-14 w-full rounded-btn bg-brand text-[16px] font-bold text-white shadow-cta active:bg-brand-dark disabled:opacity-40"
              >
                {busy ? '저장 중…' : '시작하기'}
              </button>
              <button
                onClick={() => membership && onDone(membership)}
                className="h-11 w-full rounded-btn bg-bg text-[14px] font-semibold text-sub active:bg-line"
              >
                건너뛰기 (기본값 사용)
              </button>
            </div>
          ) : invited ? (
            /* 초대 링크로 온 사람 — 코드는 이미 있다. 고를 것도, 적을 것도 없다.
               '새로 만들기'를 같이 보여주면 그걸 눌러 딴 집을 만들어 버린다. */
            <div className="mt-8 space-y-3">
              <div className="rounded-card bg-card p-5 shadow-card">
                <div className="mb-3 flex items-center gap-2">
                  <KeyRound size={18} className="text-pink-500" />
                  <p className="text-[15px] font-bold text-ink">초대 코드 확인됐어요</p>
                </div>
                <p className="tnum rounded-btn bg-bg py-3 text-center text-[18px] font-bold tracking-[0.3em] text-ink">
                  {invited}
                </p>
                <button
                  onClick={handleJoin}
                  disabled={busy}
                  className="mt-3 h-14 w-full rounded-btn bg-pink-500 text-[16px] font-bold text-white shadow-cta active:bg-pink-600 disabled:opacity-40"
                >
                  {busy ? '연결 중…' : '참여하기'}
                </button>
              </div>
              <button
                onClick={dropInvite}
                className="h-11 w-full rounded-btn bg-bg text-[13.5px] font-semibold text-sub active:bg-line"
              >
                초대가 아니라 새로 시작하고 싶어요
              </button>
            </div>
          ) : (
            <div className="mt-8 space-y-3">
              {/* 새로 만들기 */}
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

              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-line" />
                <span className="text-[12px] text-cap">또는</span>
                <div className="h-px flex-1 bg-line" />
              </div>

              {/* 초대 코드 입력 — 바로 노출 */}
              <div className="rounded-card bg-card p-4 shadow-card">
                <div className="mb-2 flex items-center gap-2">
                  <KeyRound size={18} className="text-pink-500" />
                  <p className="text-[15px] font-bold text-ink">배우자 초대 코드 입력</p>
                </div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  placeholder="8자리 코드 (예: 3F2A9C1B)"
                  maxLength={8}
                  className="w-full rounded-btn border border-line bg-white px-4 py-3.5 text-center text-[18px] font-bold tracking-[0.3em] text-ink outline-none focus:border-brand placeholder:text-[14px] placeholder:font-normal placeholder:tracking-normal placeholder:text-cap"
                />
                <button
                  onClick={handleJoin}
                  disabled={busy || code.trim().length < 8}
                  className="mt-2 h-12 w-full rounded-btn bg-pink-500 text-[15px] font-bold text-white shadow-cta active:bg-pink-600 disabled:opacity-40"
                >
                  {busy ? '연결 중…' : '참여하기'}
                </button>
              </div>
            </div>
          )}

          {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

          {mode !== 'profile' && (
            <button
              onClick={() => supabase.auth.signOut()}
              className="mt-8 w-full text-center text-[13px] text-cap underline"
            >
              다른 계정으로 로그인
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
