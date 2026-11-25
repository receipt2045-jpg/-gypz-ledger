import { displayOwner } from './assetOwner'
import { assetSeries } from './assetGlance'
import { displayYm, resolveSnapshot, totalAssets } from './carryover'
import { krwOf, type Rates } from './fx'
import type { AssetItem, AssetSnapshot, Profile } from '../types'

/**
 * 전체 자산 흐름 — 자산 탭과 홈에서 같이 쓴다 (2026-11-17).
 * 기록한 달부터 최근 12개월, 달마다 항목까지 담아 점을 누르면 지난달과 견준 표를 그린다.
 * 지금 달은 외화를 실시간 환율로 바꾼 값으로 맞춘다.
 */
export function assetTrend(snapshots: AssetSnapshot[], profile: Profile, rates: Rates) {
  const latestYm = displayYm(snapshots)
  const own = (it: AssetItem) => ({ ...it, owner: displayOwner(it.owner, profile) })
  const stored = resolveSnapshot(snapshots, latestYm)
  const items = stored.items.map((it) => ({ ...own(it), amount: krwOf(it, rates) }))
  const assets = totalAssets({ ...stored, items })
  const series = assetSeries(snapshots, latestYm, 12).map((d, i, arr) =>
    i === arr.length - 1
      ? { ...d, value: assets, items }
      : { ...d, items: resolveSnapshot(snapshots, d.ym).items.map(own) },
  )
  return { latestYm, items, assets, series }
}
