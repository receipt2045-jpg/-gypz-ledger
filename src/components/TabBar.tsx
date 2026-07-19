import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Map, BookText, Wallet, HandCoins } from 'lucide-react'

const LEFT = [
  { to: '/', label: '홈', Icon: Home },
  { to: '/roadmap', label: '내집마련', Icon: Map },
] as const

const RIGHT = [
  { to: '/monthly', label: '가계부', Icon: BookText },
  { to: '/assets', label: '자산', Icon: Wallet },
] as const

function Tab({ to, label, Icon }: { to: string; label: string; Icon: typeof Home }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
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
  const navigate = useNavigate()
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-app -translate-x-1/2 border-t border-line bg-white/95 backdrop-blur">
      <div className="grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {LEFT.map((t) => (
          <Tab key={t.to} {...t} />
        ))}

        {/* 가운데 고백 버튼 — 매일 누르는 핵심 액션 */}
        <button
          onClick={() => navigate('/confess')}
          className="flex flex-col items-center gap-1 py-0.5"
          aria-label="고백하기"
        >
          <span
            className="-mt-5 flex items-center justify-center rounded-full bg-ink shadow-cta transition-transform active:scale-95"
            style={{ width: 52, height: 52 }}
          >
            <HandCoins size={24} className="text-white" />
          </span>
          <span className="text-[11px] font-bold text-ink">고백</span>
        </button>

        {RIGHT.map((t) => (
          <Tab key={t.to} {...t} />
        ))}
      </div>
    </nav>
  )
}
