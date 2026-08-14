import { Suspense, lazy } from 'react'
import type { MonthPoint } from './MonthlyCombo'
import type { NetWorthPoint } from './NetWorthChart'
import type { RatePoint } from './SavingRateBars'

/**
 * 그래프는 볼 때만 받아온다.
 *
 * recharts는 앱에서 제일 무거운 부품이다(전체 464KB 중 434KB). 예전엔
 * 고백만 하고 나가는 사람도 이걸 통째로 받았다. 방문자가 늘면 그게
 * 그대로 대역폭 요금이 된다.
 *
 * 받아오는 동안엔 같은 높이의 빈 자리를 두어 화면이 튀지 않게 한다.
 */
function Placeholder({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-card bg-line/60 ${className}`} />
}

const MonthlyCombo = lazy(() => import('./MonthlyCombo'))
const AssetDonut = lazy(() => import('./AssetDonut'))
const NetWorthChart = lazy(() => import('./NetWorthChart'))
const SavingRateBars = lazy(() => import('./SavingRateBars'))

export function LazyMonthlyCombo({ data }: { data: MonthPoint[] }) {
  return (
    <Suspense fallback={<Placeholder className="h-[180px] w-full" />}>
      <MonthlyCombo data={data} />
    </Suspense>
  )
}

export function LazyAssetDonut({ assets, debts }: { assets: number; debts: number }) {
  return (
    <Suspense fallback={<Placeholder className="h-[200px] w-full" />}>
      <AssetDonut assets={assets} debts={debts} />
    </Suspense>
  )
}

export function LazyNetWorthChart({ series }: { series: NetWorthPoint[] }) {
  return (
    <Suspense fallback={<Placeholder className="h-full w-full" />}>
      <NetWorthChart series={series} />
    </Suspense>
  )
}

export function LazySavingRateBars({ data }: { data: RatePoint[] }) {
  return (
    <Suspense fallback={<Placeholder className="h-full w-full" />}>
      <SavingRateBars data={data} />
    </Suspense>
  )
}
