import { NavLink } from 'react-router-dom'
import { BookOpen, Home, Landmark, Newspaper, Settings } from 'lucide-react'
import { useLedgerStore } from '../lib/store'

/**
 * 하단 탭 (2026-09-30 개편).
 *
 * 자산 로드맵을 뺐다 — 카드가 많고 같은 말을 반복해서 무엇을 하라는 건지 흐렸다.
 * 소비 기록은 가계부 안으로 들어갔다(가계부 맨 위 '오늘의 소비 기록'). 오늘 기록 전이면
 * 가계부 탭에 빨간 점. 게시판은 공지·계산기·정보를 모은 '정보' 탭이 됐다.
 */
const LEFT = [
  { to: '/monthly', label: '가계부', Icon: BookOpen },
  { to: '/assets', label: '자산', Icon: Landmark },
] as const

const RIGHT = [
  { to: '/info', label: '정보', Icon: Newspaper },
  { to: '/settings', label: '설정', Icon: Settings },
] as const

/** 오늘 날짜 키 (로컬 기준) — reactions.streakOf와 같은 방식 */
const dayKey = (d: Date) => d.toLocaleDateString('sv-SE')

function Tab({
  to,
  label,
  Icon,
  pending,
}: {
  to: string
  label: string
  Icon: typeof Home
  pending?: boolean // 오늘 아직 안 한 일이 있으면 살짝 강조 + 빨간 점
}) {
  return (
    <NavLink
      to={to}
      className="flex flex-col items-center gap-1 rounded-xl py-1.5 transition-colors"
    >
      {({ isActive }) => {
        const tone = isActive ? 'text-brand' : pending ? 'text-ink' : 'text-cap'
        return (
          <>
            <span className="relative">
              <Icon size={23} strokeWidth={isActive || pending ? 2.4 : 2} className={tone} />
              {pending && !isActive && (
                <span className="absolute -right-1.5 -top-0.5 h-2 w-2 rounded-full bg-danger ring-2 ring-white" />
              )}
            </span>
            <span
              className={`text-center text-[11px] leading-tight ${pending ? 'font-bold' : 'font-medium'} ${tone}`}
            >
              {label}
            </span>
          </>
        )
      }}
    </NavLink>
  )
}

/** 오늘 내가 기록했는지 — 안 했으면 가계부 탭에 빨간 점 (소비 기록이 가계부 안에 있다) */
function useConfessedToday() {
  const { confessions, memberNo } = useLedgerStore()
  const today = dayKey(new Date())
  const me = memberNo ?? 1
  return confessions.some((c) => c.memberNo === me && dayKey(new Date(c.createdAt)) === today)
}

export default function TabBar() {
  const confessedToday = useConfessedToday()

  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-app -translate-x-1/2 border-t border-line bg-white/95 backdrop-blur lg:hidden">
      <div className="grid grid-cols-5 items-start px-1 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {LEFT.map((t) => (
          <Tab key={t.to} {...t} pending={t.to === '/monthly' && !confessedToday} />
        ))}

        {/* 가운데 홈 — 모든 화면의 허브 */}
        <NavLink to="/" end className="flex flex-col items-center gap-1 py-0.5" aria-label="홈">
          {({ isActive }) => (
            <>
              <span
                className={`-mt-5 flex items-center justify-center rounded-full shadow-cta transition-transform active:scale-95 ${
                  isActive ? 'bg-brand' : 'bg-ink'
                }`}
                style={{ width: 52, height: 52 }}
              >
                <Home size={24} className="text-white" />
              </span>
              <span className={`text-[11px] font-bold ${isActive ? 'text-brand' : 'text-ink'}`}>
                홈
              </span>
            </>
          )}
        </NavLink>

        {RIGHT.map((t) => (
          <Tab key={t.to} {...t} />
        ))}
      </div>
    </nav>
  )
}

const SIDE = [
  { to: '/', label: '홈', Icon: Home, end: true },
  { to: '/monthly', label: '가계부', Icon: BookOpen, end: false },
  { to: '/assets', label: '자산', Icon: Landmark, end: false },
  { to: '/info', label: '정보', Icon: Newspaper, end: false },
  { to: '/settings', label: '설정', Icon: Settings, end: false },
] as const

/** PC(가로 1024px 이상) 왼쪽 메뉴 — 아래 탭과 같은 다섯 칸 (2026-10-06) */
export function SideNav({ active }: { active?: string } = {}) {
  const confessedToday = useConfessedToday()
  return (
    <nav
      aria-label="메뉴"
      className="sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col border-r border-line bg-white px-3 py-6 lg:flex"
    >
      <NavLink to="/" end className="mb-6 flex items-center gap-2 px-3">
        <img src="/favicon.svg" alt="" className="h-8 w-8" />
        <span className="text-[16px] font-bold text-ink">모아불리 가계부</span>
      </NavLink>
      <div className="space-y-1">
        {SIDE.map(({ to, label, Icon, end }) => {
          const pending = to === '/monthly' && !confessedToday
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive: on }) => {
                const isActive = on || to === active
                return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors ${
                  isActive ? 'bg-brand/10 font-bold text-brand' : 'font-medium text-sub hover:bg-bg'
                }`
              }}
            >
              <span className="relative">
                <Icon size={20} />
                {pending && (
                  <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-danger ring-2 ring-white" />
                )}
              </span>
              {label}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
