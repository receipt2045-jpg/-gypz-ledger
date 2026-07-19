import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import type { Session, User } from '@supabase/supabase-js'
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
import Confess from './pages/Confess'
import Roadmap from './pages/Roadmap'
import AssetSetup from './pages/AssetSetup'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import IntroSlides from './pages/IntroSlides'
import Legal from './pages/Legal'

export default function App() {
  return (
    <Routes>
      {/* 방침·약관은 로그인 전에도 열람 가능 */}
      <Route path="/legal/:doc" element={<Legal />} />
      <Route path="*" element={<AuthGate />} />
    </Routes>
  )
}

function AuthGate() {
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
  return <AuthedFlow key={session.user.id} user={session.user} />
}

/** 로그인 직후: 최초 1회 온보딩 → (선택) 샘플 둘러보기 → 가구 연결 */
function AuthedFlow({ user }: { user: User }) {
  // 온보딩 여부는 계정 플래그(user_metadata)로 저장 → 기기가 바뀌어도 반복 노출 없음
  const [intro, setIntro] = useState(() => !user.user_metadata?.onboarded)
  const [sampleMode, setSampleMode] = useState(false)
  const loadSample = useLedgerStore((s) => s.loadSample)
  const clear = useLedgerStore((s) => s.clear)

  const finishIntro = (sample: boolean) => {
    setIntro(false)
    supabase.auth.updateUser({ data: { onboarded: true } }).catch(console.error)
    if (sample) {
      loadSample()
      setSampleMode(true)
    }
  }

  if (intro)
    return <IntroSlides onStart={() => finishIntro(false)} onSample={() => finishIntro(true)} />

  if (sampleMode)
    return (
      <>
        <AppRoutes />
        {/* 샘플 모드 안내 바 (DB 저장 없음) */}
        <div className="fixed left-1/2 top-0 z-50 w-full max-w-app -translate-x-1/2 px-3 pt-2">
          <div className="flex items-center justify-between gap-2 rounded-card bg-ink px-4 py-2.5 text-white shadow-lg">
            <span className="text-[13px] font-medium">샘플 데이터를 보는 중이에요</span>
            <button
              onClick={() => {
                clear()
                setSampleMode(false)
              }}
              className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-[12px] font-bold text-white active:bg-brand-dark"
            >
              내 가계부 시작하기
            </button>
          </div>
        </div>
      </>
    )

  return <HouseholdGate />
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppFrame />}>
        <Route path="/" element={<Home />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/monthly" element={<Monthly />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/yearly" element={<Yearly />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="/checkup" element={<Checkup />} />
      <Route path="/confess" element={<Confess />} />
      <Route path="/asset-setup" element={<AssetSetup />} />
    </Routes>
  )
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

  return <AppRoutes />
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
