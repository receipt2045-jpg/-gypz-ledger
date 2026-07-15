import { NavLink } from 'react-router-dom'
import { Home, BookText, Wallet, BarChart3, Settings } from 'lucide-react'

const TABS = [
  { to: '/', label: '홈', Icon: Home },
  { to: '/monthly', label: '가계부', Icon: BookText },
  { to: '/assets', label: '자산', Icon: Wallet },
  { to: '/yearly', label: '리포트', Icon: BarChart3 },
  { to: '/settings', label: '설정', Icon: Settings },
] as const

export default function TabBar() {
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-app -translate-x-1/2 border-t border-line bg-white/95 backdrop-blur">
      <div className="grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
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
                <span
                  className={`text-[11px] font-medium ${isActive ? 'text-brand' : 'text-cap'}`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
