import { NavLink } from 'react-router-dom'
import { Home, Map, BookText, Wallet, HandCoins } from 'lucide-react'
import { useLedgerStore } from '../lib/store'

// 자주 쓰는 순서: 자산·가계부 → (홈) → 내집마련·고백
const LEFT = [
  { to: '/assets', label: '자산', Icon: Wallet },
  { to: '/monthly', label: '가계부', Icon: BookText },
] as const

const RIGHT = [
  { to: '/roadmap', label: '내집마련', Icon: Map },
  { to: '/confess', label: '고백', Icon: HandCoins },
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
            <span className={`text-[11px] ${pending ? 'font-bold' : 'font-medium'} ${tone}`}>
              {label}
            </span>
          </>
        )
      }}
    </NavLink>
  )
}

export default function TabBar() {
  const { confessions, memberNo } = useLedgerStore()

  // 오늘 내가 고백했는지 — 안 했으면 고백 탭에 빨간 점
  const today = dayKey(new Date())
  const me = memberNo ?? 1
  const confessedToday = confessions.some(
    (c) => c.memberNo === me && dayKey(new Date(c.createdAt)) === today,
  )

  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-app -translate-x-1/2 border-t border-line bg-white/95 backdrop-blur">
      <div className="grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {LEFT.map((t) => (
          <Tab key={t.to} {...t} />
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
          <Tab key={t.to} {...t} pending={t.to === '/confess' && !confessedToday} />
        ))}
      </div>
    </nav>
  )
}
