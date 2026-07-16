import { Building2, Car, CreditCard, ShieldCheck, TrendingUp, Wallet } from 'lucide-react'
import type { AssetGroup } from '../types'

// 그룹별 아이콘 + 색상 (부채는 kind로 오버라이드)
const GROUP_ICON: Record<AssetGroup, { Icon: typeof Wallet; fg: string; bg: string }> = {
  cash: { Icon: Wallet, fg: 'text-blue-500', bg: 'bg-blue-50' },
  stock: { Icon: TrendingUp, fg: 'text-emerald-500', bg: 'bg-emerald-50' },
  realestate: { Icon: Building2, fg: 'text-amber-500', bg: 'bg-amber-50' },
  pension: { Icon: ShieldCheck, fg: 'text-violet-500', bg: 'bg-violet-50' },
  consumable: { Icon: Car, fg: 'text-slate-500', bg: 'bg-slate-100' },
}

const DEBT_ICON = { Icon: CreditCard, fg: 'text-danger', bg: 'bg-red-50' }

export default function AssetIcon({
  group,
  kind = 'asset',
  size = 40,
}: {
  group: AssetGroup
  kind?: 'asset' | 'debt'
  size?: number
}) {
  const { Icon, fg, bg } = kind === 'debt' ? DEBT_ICON : GROUP_ICON[group]
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full ${bg} ${fg}`}
      style={{ width: size, height: size }}
    >
      <Icon size={size * 0.5} />
    </div>
  )
}
