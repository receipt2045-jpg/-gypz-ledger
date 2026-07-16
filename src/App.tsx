import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { getMyMembership, type Membership } from './lib/db'
import { useLedgerStore } from './lib/store'
import AppFrame from './components/AppFrame'
import Home from './pages/Home'
import Monthly from './pages/Monthly'
import Assets from './pages/Assets'
import Yearly from './pages/Yearly'
import Settings from './pages/Settings'
import Checkup from './pages/Checkup'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) useLedgerStore.getState().clear()
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!authReady) return <Splash message="로그인 확인 중…" />
  if (!session) return <Login />
  // key로 사용자 전환 시 게이트 상태 초기화
  return <HouseholdGate key={session.user.id} />
}

/** 로그인 후: 가구 연결 확인 → 데이터 로드 → 앱 본체 */
function HouseholdGate() {
  const [membership, setMembership] = useState<Membership | null>(null)
  const [checked, setChecked] = useState(false)
  const [loadError, setLoadError] = useState('')
  const init = useLedgerStore((s) => s.init)
  const status = useLedgerStore((s) => s.status)

  useEffect(() => {
    getMyMembership()
      .then((m) => {
        setMembership(m)
        setChecked(true)
      })
      .catch((err) => {
        console.error(err)
        setLoadError(
          '데이터베이스에 연결하지 못했어요. Supabase에 스키마(SQL)를 실행했는지 확인해 주세요.',
        )
        setChecked(true)
      })
  }, [])

  useEffect(() => {
    if (membership) init(membership)
  }, [membership, init])

  if (loadError) return <Splash message={loadError} error />
  if (!checked) return <Splash message="가계부 연결 확인 중…" />
  if (!membership) return <Onboarding onDone={setMembership} />
  if (status === 'error')
    return <Splash message="데이터를 불러오지 못했어요. 새로고침해 주세요." error />
  if (status !== 'ready') return <Splash message="데이터 불러오는 중…" />

  return (
    <Routes>
      <Route element={<AppFrame />}>
        <Route path="/" element={<Home />} />
        <Route path="/monthly" element={<Monthly />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/yearly" element={<Yearly />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="/checkup" element={<Checkup />} />
    </Routes>
  )
}

function Splash({ message, error }: { message: string; error?: boolean }) {
  return (
    <div className="flex min-h-screen justify-center bg-[#e6e9ed]">
      <div className="flex min-h-screen w-full max-w-app flex-col items-center justify-center bg-bg px-8 shadow-[0_0_60px_rgba(0,0,0,0.06)]">
        {!error && (
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-brand" />
        )}
        <p
          className={`text-center text-[14px] leading-relaxed ${error ? 'text-danger' : 'text-sub'}`}
        >
          {message}
        </p>
        {error && (
          <button
            onClick={() => supabase.auth.signOut()}
            className="mt-6 text-[13px] text-cap underline"
          >
            로그아웃
          </button>
        )}
      </div>
    </div>
  )
}
