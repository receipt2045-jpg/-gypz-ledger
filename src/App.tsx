import RetireCalc from './pages/RetireCalc'
import LoanCalc from './pages/LoanCalc'
import HomeCostCalc from './pages/HomeCostCalc'
import LoanFinderCalc from './pages/LoanFinderCalc'
import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { attachSourceToUser, captureSource } from './lib/source'
import { capturePendingInvite, restoreInviteFromAccount } from './lib/invite'
import { applyMarketingChoice } from './lib/marketing'
import { rememberLogin, startsAtLogin } from './lib/preview'
import { getMyMembership, type Membership } from './lib/db'
import { useLedgerStore } from './lib/store'
import AppFrame from './components/AppFrame'
import SyncBanner from './components/SyncBanner'
import UpdateBanner from './components/UpdateBanner'
import PreviewBar from './components/PreviewBar'
import Home from './pages/Home'
import Monthly from './pages/Monthly'
import Assets from './pages/Assets'
import Stocks from './pages/Stocks'
import StockJournal from './pages/StockJournal'
import Yearly from './pages/Yearly'
import Settings from './pages/Settings'
import Checkup from './pages/Checkup'
import Budget from './pages/Budget'
import Story from './pages/Story'
import Qna from './pages/Qna'
import Consult from './pages/Consult'
import AdminConsult from './pages/AdminConsult'
import Confess from './pages/Confess'
import Info from './pages/Info'
import PostDetail from './pages/PostDetail'
import InfoArchive from './pages/InfoArchive'
import AdminPosts from './pages/AdminPosts'
import AdminFeedback from './pages/AdminFeedback'
import AdminReports from './pages/AdminReports'
import AssetSetup from './pages/AssetSetup'
import Report from './pages/Report'
import YearEndTax from './pages/YearEndTax'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import IntroSlides from './pages/IntroSlides'
import Legal from './pages/Legal'
import ParentalLeave from './pages/ParentalLeave'
import Gold from './pages/Gold'
import GiftGuide from './pages/GiftGuide'
import ChildBenefit from './pages/ChildBenefit'
import Share from './pages/Share'
import PublicNews from './pages/PublicNews'
import Roadmap from './pages/Roadmap'

export default function App() {
  return (
    <>
      {/* 홈 화면 앱은 옛 파일을 붙들고 있는 일이 잦다 — 새로 배포되면 알려준다 */}
      <UpdateBanner />
      <Routes>
        {/* 방침·약관은 로그인 전에도 열람 가능 */}
        <Route path="/legal/:doc" element={<Legal />} />
        {/* 육아휴직 계산기 — 영상·SNS에서 바로 들어오는 자리라 로그인 밖에 둔다 */}
        <Route path="/leave" element={<ParentalLeave />} />
        {/* 금테크 정리 — 단톡·인스타에서 바로 들어오는 자리라 로그인 밖에 둔다 */}
        <Route path="/gold" element={<Gold />} />
        {/* 아이 통장 증여 신고 정리 · 부모급여·아동수당 계산기 (2026-10-27) — 공개 자료 */}
        <Route path="/gift-guide" element={<GiftGuide />} />
        <Route path="/child-benefit" element={<ChildBenefit />} />
        {/* 결영이네 자료 나눔 목록 (2026-10-24) — 단톡방 공지에 거는 링크 하나 */}
        <Route path="/share" element={<Share />} />
        {/* 오늘의 경제 — 카톡 톡방 링크로 들어오는 자리라 로그인 밖에 둔다 */}
        <Route path="/news" element={<PublicNews />} />
        <Route path="/news/:id" element={<PublicNews />} />
        {/* 원팀 프로젝트 이야기 — 카톡·인스타로 나누는 자리라 로그인 밖에 둔다 */}
        <Route path="/story" element={<Story />} />
        {/* 묻고 답하기·상담 신청 (2026-10-21) — 유튜브·인스타 링크로 들어오는 자리라 로그인 밖에 둔다 */}
        <Route path="/qna" element={<Qna />} />
        <Route path="/qna/:id" element={<Qna />} />
        <Route path="/consult" element={<Consult />} />
        <Route path="*" element={<AuthGate />} />
      </Routes>
    </>
  )
}

/**
 * 로그인 직후 계정에 옮겨 둘 것들.
 * 둘 다 로그인 페이지를 거치며 화면에서 사라지는 값이라 localStorage에 맡겨 뒀다가 여기서 옮긴다.
 */
async function onSignedIn(user: User) {
  rememberLogin(true) // 다음에 이 기기로 오면 예시 대신 로그인 화면부터
  await attachSourceToUser(user)
  await applyMarketingChoice(user)
}

/**
 * 개발 전용: 로그인 없이 샘플 데이터로 앱 전체를 띄운다 (`?sample=1`).
 * 화면을 하나하나 눌러보며 검토할 때 쓴다. 배포본(PROD)에서는 이 분기가 사라진다 —
 * householdId가 null이라 서버 호출도 전부 건너뛴다.
 */
function DevSample() {
  const loadSample = useLedgerStore((s) => s.loadSample)
  const status = useLedgerStore((s) => s.status)
  useEffect(() => {
    loadSample()
  }, [loadSample])
  if (status !== 'ready') return <Splash message="샘플 불러오는 중…" />
  return <AppRoutes />
}

/**
 * 로그인 전 둘러보기 (2026-10-23, 결영이네 요청: "예시 화면 먼저 보여주고 쓰고 싶게 만든 다음,
 * 우리 부부 걸 쓰려면 회원가입"). 예시 데이터로 앱 전체를 띄우고 맨 위에 가입 안내 바를 붙인다.
 * householdId가 null이라 눌러서 적은 것은 서버에 안 간다.
 */
function Preview({ onLogin }: { onLogin: () => void }) {
  const loadSample = useLedgerStore((s) => s.loadSample)
  const clear = useLedgerStore((s) => s.clear)
  const status = useLedgerStore((s) => s.status)
  useEffect(() => {
    loadSample()
    return () => clear() // 가입·로그인하면 예시를 지우고 우리집 것을 불러온다
  }, [loadSample, clear])
  if (status !== 'ready') return <Splash message="예시 가계부 불러오는 중…" />
  return (
    <>
      {/* 안내 바가 화면 맨 위를 가리지 않게 그만큼 내린다 */}
      <div className="h-[58px]" aria-hidden />
      <AppRoutes />
      <PreviewBar onStart={onLogin} onLogin={onLogin} />
    </>
  )
}

function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const devSample = import.meta.env.DEV && new URLSearchParams(window.location.search).has('sample')
  // 처음 온 사람은 예시부터, 초대 링크·가입해 본 기기는 로그인부터
  const [atLogin, setAtLogin] = useState(startsAtLogin)

  useEffect(() => {
    // 샘플 모드에선 로그인 상태를 보지 않는다 — 안 보면 onAuthStateChange가 clear()로 샘플을 지운다
    if (devSample) return
    captureSource() // 나눔 링크(?src=)로 왔으면 채널을 기억해 둔다
    capturePendingInvite() // 초대 링크(#/join/CODE)면 코드를 챙긴다 — 로그인하면 해시가 날아간다
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
      if (data.session) void onSignedIn(data.session.user)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) void onSignedIn(s.user)
      // 로그아웃 상태로 시작할 때도 이 이벤트가 온다 — 둘러보기 예시까지 지우면 안 된다
      if (!s && !useLedgerStore.getState().sample) useLedgerStore.getState().clear()
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (devSample) return <DevSample />
  if (!authReady) return <Splash message="로그인 확인 중…" />
  if (!session)
    return atLogin ? (
      <Login
        onPreview={() => {
          rememberLogin(false)
          setAtLogin(false)
        }}
      />
    ) : (
      <Preview
        onLogin={() => {
          rememberLogin(true)
          setAtLogin(true)
          window.scrollTo(0, 0)
        }}
      />
    )
  // key로 사용자 전환 시 게이트 상태 초기화
  return <AuthedFlow key={session.user.id} user={session.user} />
}

/** 로그인 직후: 최초 1회 온보딩 → (선택) 샘플 둘러보기 → 가구 연결 */
function AuthedFlow({ user }: { user: User }) {
  // 가입할 때 계정에 적어 둔 초대 코드 — 가계부 연결 화면보다 먼저 꺼내 둔다
  useState(() => restoreInviteFromAccount(user.user_metadata))
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
    <>
      <SyncBanner />
      <Routes>
        <Route element={<AppFrame />}>
          <Route path="/" element={<Home />} />
          <Route path="/info" element={<Info />} />
          <Route path="/info/archive" element={<InfoArchive />} />
          {/* 돈 공부 계산기 (2026-10-07) */}
          <Route path="/calc/retire" element={<RetireCalc />} />
          <Route path="/calc/loan" element={<LoanCalc />} />
          <Route path="/calc/home-cost" element={<HomeCostCalc />} />
          <Route path="/calc/home-loan" element={<LoanFinderCalc />} />
          <Route path="/info/:id" element={<PostDetail />} />
          {/* 옛 탭 주소(2026-09-30 개편 전) — 홈 화면 바로가기·링크가 깨지지 않게 */}
          <Route path="/board" element={<Navigate to="/info" replace />} />
          <Route path="/monthly" element={<Monthly />} />
          <Route path="/assets" element={<Assets />} />
          {/* 주식 일지 (2026-10-25) — 자산 탭 주식 칸에서 들어온다 */}
          <Route path="/stocks" element={<Stocks />} />
          <Route path="/stocks/:id" element={<StockJournal />} />
          <Route path="/yearly" element={<Yearly />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="/admin/feedback" element={<AdminFeedback />} />
        <Route path="/admin/posts" element={<AdminPosts />} />
        <Route path="/admin/reports" element={<AdminReports />} />
        <Route path="/admin/consult" element={<AdminConsult />} />
        <Route path="/checkup" element={<Checkup />} />
        <Route path="/budget" element={<Budget />} />
        <Route path="/confess" element={<Confess />} />
        <Route path="/asset-setup" element={<AssetSetup />} />
        <Route path="/year-end-tax" element={<YearEndTax />} />
        {/* 자산 로드맵 (2026-10-05 다시) — 탭 밖, 설정·홈 목표 카드에서 들어온다 */}
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/report" element={<Report />} />
      </Routes>
    </>
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
