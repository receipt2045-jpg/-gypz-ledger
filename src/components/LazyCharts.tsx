import { Suspense, lazy } from 'react'
import type { MonthPoint } from './MonthlyCombo'
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

/**
 * 새로 배포된 직후 옛 파일을 못 찾으면 main.tsx가 새로 고침을 걸고 오류를 삼킨다(vite:preloadError).
 * 그때 import가 빈 값으로 끝나 React가 "reading 'default'" 오류를 냈다 (2026-11-24 자동 오류 제보).
 * 빈 값이면 새로 고침이 끝날 때까지 빈 자리(Suspense)로 기다린다.
 */
function waitIfReloading<T>(load: () => Promise<T | undefined>): () => Promise<T> {
  return () => load().then((m) => m ?? new Promise<T>(() => {}))
}

const MonthlyCombo = lazy(waitIfReloading(() => import('./MonthlyCombo')))
const SavingRateBars = lazy(waitIfReloading(() => import('./SavingRateBars')))

export function LazyMonthlyCombo({ data }: { data: MonthPoint[] }) {
  return (
    <Suspense fallback={<Placeholder className="h-[180px] w-full" />}>
      <MonthlyCombo data={data} />
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
