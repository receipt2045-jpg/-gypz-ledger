import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import type { Recipe, Role } from '../../lib/recipes'

export const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
/** 12,520 → "1만 2,500원" — 큰 숫자는 백 원 단위로 */
export const wonShort = (n: number) => {
  const r = Math.round(n / 100) * 100
  const man = Math.floor(r / 10_000)
  const rest = r % 10_000
  if (!man) return `${rest.toLocaleString('ko-KR')}원`
  return rest ? `${man}만 ${rest.toLocaleString('ko-KR')}원` : `${man}만 원`
}
/** 450000 → "45만" */
export const man = (n: number) => {
  const v = Math.round(n / 1000) / 10
  return `${Number.isInteger(v) ? v : v.toFixed(1)}만`
}

export const ROLE_NAME: Record<Role, string> = { main: '메인', sub: '서브', soup: '국', one: '한 그릇' }
export const ROLE_TINT: Record<Role, string> = {
  main: 'bg-orange-50 text-orange-700',
  sub: 'bg-green-50 text-green-700',
  soup: 'bg-blue-50 text-blue-700',
  one: 'bg-bg text-sub',
}

export function RoleTag({ role }: { role: Role }) {
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold ${ROLE_TINT[role]}`}>
      {ROLE_NAME[role]}
    </span>
  )
}

export function KidTag({ r }: { r: Recipe }) {
  if (r.kid === 'adult') return <span className="rounded-md bg-bg px-1.5 py-0.5 text-[11px] font-bold text-sub">어른 메뉴</span>
  return (
    <span className="rounded-md bg-pink-50 px-1.5 py-0.5 text-[11px] font-bold text-pink-700">
      {r.kid === 'ok' ? '아이 OK' : '아이는 덜어서'}
    </span>
  )
}

/** 사진 — 아직 없는 레시피는 그림 글자 */
export function Dish({ r, className }: { r: Recipe; className: string }) {
  if (r.photo) return <img src={r.photo.src} alt={r.name} loading="lazy" className={`${className} bg-bg object-cover`} />
  return (
    <div className={`${className} flex items-center justify-center bg-orange-50`} aria-hidden>
      <span className="text-[44px] leading-none">{r.emoji}</span>
    </div>
  )
}

export function Part({ title, right, children }: { title: string; right?: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h2 className="text-[19px] font-extrabold text-ink">{title}</h2>
        {right && <span className="text-[14px] text-sub">{right}</span>}
      </div>
      {children}
    </section>
  )
}

export function Back({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => {
        navigate(to)
        window.scrollTo(0, 0)
      }}
      className="-ml-1 flex items-center gap-0.5 text-[14px] font-semibold text-sub"
    >
      <ChevronLeft size={19} />
      {label}
    </button>
  )
}

/** 이번 주 · 레시피 · 제철 */
export function Tabs({ at }: { at: 'week' | 'all' | 'season' }) {
  const navigate = useNavigate()
  const tabs = [
    ['week', '이번 주 집밥', '/recipes'],
    ['all', '레시피', '/recipes/all'],
    ['season', '제철 달력', '/recipes/season'],
  ] as const
  return (
    <nav className="sticky top-0 z-10 flex gap-1 border-b border-line bg-white px-3 pt-3">
      {tabs.map(([k, label, to]) => (
        <button
          key={k}
          onClick={() => {
            navigate(to)
            window.scrollTo(0, 0)
          }}
          aria-current={at === k ? 'page' : undefined}
          className={`border-b-2 px-3 pb-2.5 text-[15px] font-bold ${
            at === k ? 'border-ink text-ink' : 'border-transparent text-cap'
          }`}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}

/** 막대 하나 — 넘으면 빨강 */
export function Bar({ value, max, tone = 'brand' }: { value: number; max: number; tone?: 'brand' | 'green' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const over = max > 0 && value > max
  return (
    <div className="h-2 overflow-hidden rounded-full bg-line">
      <div
        className={`h-2 rounded-full ${over ? 'bg-danger' : tone === 'green' ? 'bg-green-500' : 'bg-orange-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
