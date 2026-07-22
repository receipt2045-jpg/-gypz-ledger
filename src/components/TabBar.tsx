import { NavLink } from 'react-router-dom'
import { Home, Map, BookText, Wallet, HandCoins } from 'lucide-react'

// 자주 쓰는 순서: 자산·가계부 → (홈) → 내집마련·고백
const LEFT = [
  { to: '/assets', label: '자산', Icon: Wallet },
  { to: '/monthly', label: '가계부', Icon: BookText },
] as const

const RIGHT = [
  { to: '/roadmap', label: '내집마련', Icon: Map },
  { to: '/confess', label: '고백', Icon: HandCoins },
] as const

function Tab({ to, label, Icon }: { to: string; label: string; Icon: typeof Home }) {
  return (
    <NavLink
      to={to}
      className="flex flex-col items-center gap-1 rounded-xl py-1.5 transition-colors"
    >
      {({ isActive }) => (
        <>
          <Icon
            size={23}
            strokeWidth={isActive ? 2.4 : 2}
            className={isActive ? 'text-brand' : 'text-cap'}
          />
          <span className={`text-[11px] font-medium ${isActive ? 'text-brand' : 'text-cap'}`}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}

export default function TabBar() {
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
          <Tab key={t.to} {...t} />
        ))}
      </div>
    </nav>
  )
}
