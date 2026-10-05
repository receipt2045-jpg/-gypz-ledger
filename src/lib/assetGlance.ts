import { resolveSnapshot, totalAssets } from './carryover'
import { ASSET_GROUP_LABEL, ASSET_GROUP_ORDER } from './constants'
import { shiftYm } from './format'
import type { AssetGroup, AssetItem, AssetSnapshot } from '../types'

/**
 * 자산 '한눈에' (2026-10-05) — 한 화면에 담아 캡처해도 우리집 자산이 다 보이게.
 * 함께 = 전체 자산 기준 그래프, 사람별 = 엑셀처럼 칸 나눈 표.
 */

export const GROUP_EMOJI: Record<AssetGroup, string> = {
  realestate: '🏠',
  stock: '📈',
  cash: '💰',
  consumable: '🚗',
  pension: '🌱',
}

export const GROUP_COLOR: Record<AssetGroup, string> = {
  realestate: '#85B7EB',
  stock: '#D4537E',
  cash: '#3182F6',
  consumable: '#B4B2A9',
  pension: '#EF9F27',
}

/** 비율을 정수로 — 반올림하면 합이 99·101이 되므로 큰 나머지부터 1씩 더한다 */
export function percents(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0)
  if (total <= 0) return values.map(() => 0)
  const raw = values.map((v) => (v / total) * 100)
  const floor = raw.map(Math.floor)
  let left = 100 - floor.reduce((a, b) => a + b, 0)
  const order = raw.map((r, i) => [r - floor[i], i] as const).sort((a, b) => b[0] - a[0])
  for (const [, i] of order) {
    if (left <= 0) break
    floor[i] += 1
    left -= 1
  }
  return floor
}

export interface GroupRow {
  group: AssetGroup
  label: string
  emoji: string
  color: string
  amount: number
  pct: number
}

/** 종류별 합계 — 금액 큰 순 (자산만) */
export function groupRows(items: AssetItem[]): GroupRow[] {
  const assets = items.filter((it) => it.kind === 'asset')
  const rows = ASSET_GROUP_ORDER.map((group) => ({
    group,
    amount: assets.filter((it) => it.group === group).reduce((a, it) => a + it.amount, 0),
  })).filter((r) => r.amount > 0)
  const pcts = percents(rows.map((r) => r.amount))
  return rows
    .map((r, i) => ({
      ...r,
      label: ASSET_GROUP_LABEL[r.group],
      emoji: GROUP_EMOJI[r.group],
      color: GROUP_COLOR[r.group],
      pct: pcts[i],
    }))
    .sort((a, b) => b.amount - a.amount)
}

/** 소유자 일치 — '공동'은 주인을 안 정한 항목까지 포함한다 (자산 화면과 같은 규칙) */
export const isOwned = (owner: string | undefined, name: string) =>
  name === '공동' ? !owner || owner === '공동' : owner === name

/** 누구 이름으로 — 자산 기준 */
export function ownerRows(items: AssetItem[], owners: string[]) {
  const assets = items.filter((it) => it.kind === 'asset')
  const rows = owners
    .map((name) => ({
      name,
      amount: assets.filter((it) => isOwned(it.owner, name)).reduce((a, it) => a + it.amount, 0),
    }))
    .filter((r) => r.amount > 0)
  const pcts = percents(rows.map((r) => r.amount))
  return rows.map((r, i) => ({ ...r, pct: pcts[i] }))
}

/** 최근 count개월 전체 자산 (과거 → 지금) */
export function assetSeries(snapshots: AssetSnapshot[], endYm: string, count: number) {
  const out: { ym: string; value: number }[] = []
  for (let i = count - 1; i >= 0; i--) {
    const ym = shiftYm(endYm, -i)
    out.push({ ym, value: totalAssets(resolveSnapshot(snapshots, ym)) })
  }
  return out
}

export interface TableRow {
  label: string
  name: string
  amount: number
  pct: number | null
}

/**
 * 사람별 자산표 — 종류 순서(예적금·투자·집·연금·기타)대로, 같은 종류는 금액 큰 순.
 * 비중은 그 사람 자산 합계 기준. 부채는 따로.
 */
export function memberTable(items: AssetItem[]) {
  const assets = items
    .filter((it) => it.kind === 'asset')
    .sort(
      (a, b) =>
        ASSET_GROUP_ORDER.indexOf(a.group) - ASSET_GROUP_ORDER.indexOf(b.group) ||
        b.amount - a.amount,
    )
  const debts = items.filter((it) => it.kind === 'debt').sort((a, b) => b.amount - a.amount)
  const pcts = percents(assets.map((it) => it.amount))
  const assetTotal = assets.reduce((a, it) => a + it.amount, 0)
  const debtTotal = debts.reduce((a, it) => a + it.amount, 0)
  return {
    assets: assets.map<TableRow>((it, i) => ({
      label: ASSET_GROUP_LABEL[it.group],
      name: it.name,
      amount: it.amount,
      pct: pcts[i],
    })),
    debts: debts.map<TableRow>((it) => ({
      label: '부채',
      name: it.name,
      amount: it.amount,
      pct: null,
    })),
    assetTotal,
    debtTotal,
    net: assetTotal - debtTotal,
  }
}
