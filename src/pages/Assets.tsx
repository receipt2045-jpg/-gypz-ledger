import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import Card from '../components/Card'
import ProgressBar from '../components/ProgressBar'
import { useLedgerStore } from '../lib/store'
import {
  netWorthOf,
  netWorthSeries,
  resolveSnapshot,
  totalAssets,
  totalDebts,
} from '../lib/carryover'
import {
  abbreviateKRW,
  currentYm,
  formatMonthKorean,
  formatPercent,
  formatWon,
} from '../lib/format'
import { ASSET_GROUP_LABEL, ASSET_GROUP_ORDER } from '../lib/constants'
import type { AssetGroup } from '../types'

export default function Assets() {
  const { snapshots, profile } = useLedgerStore()
  // 최신 스냅샷 기준
  const latestYm = snapshots.length ? snapshots[snapshots.length - 1].ym : currentYm()

  const snapshot = resolveSnapshot(snapshots, latestYm)
  const netWorth = netWorthOf(snapshot)
  const assets = totalAssets(snapshot)
  const debts = totalDebts(snapshot)

  const series = netWorthSeries(snapshots, latestYm, 6).map((d) => ({
    ...d,
    label: formatMonthKorean(d.ym),
  }))
  const prev = series.length >= 2 ? series[series.length - 2].value : netWorth
  const delta = netWorth - prev
  const up = delta >= 0

  const targetRatio = profile.targetNetWorth > 0 ? netWorth / profile.targetNetWorth : 0

  const assetItems = snapshot.items.filter((it) => it.kind === 'asset')
  const debtItems = snapshot.items.filter((it) => it.kind === 'debt')

  const groupsWithItems = ASSET_GROUP_ORDER.map((g) => ({
    group: g,
    items: assetItems.filter((it) => it.group === g),
  })).filter((x) => x.items.length > 0)

  return (
    <div className="animate-fade-up space-y-4">
      <header className="px-1 pt-2">
        <h1 className="text-[18px] font-bold text-ink">자산</h1>
      </header>

      {/* 순자산 요약 */}
      <Card>
        <p className="text-[13px] font-medium text-cap">순자산</p>
        <p className="tnum mt-1 text-[30px] font-extrabold tracking-tight text-ink">
          {abbreviateKRW(netWorth)}
        </p>
        <div
          className={`mt-1.5 inline-flex items-center gap-1 text-[14px] font-semibold ${up ? 'text-brand' : 'text-danger'}`}
        >
          {up ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          전월 대비 {up ? '+' : '−'}
          {abbreviateKRW(Math.abs(delta))}
        </div>

        {/* 순자산 추이 차트 */}
        <div className="mt-4 h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 6, bottom: 0, left: 6 }}>
              <defs>
                <linearGradient id="assetArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3182F6" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#3182F6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#8B95A1' }}
                axisLine={false}
                tickLine={false}
                dy={4}
              />
              <YAxis hide domain={['dataMin - 5000000', 'dataMax + 5000000']} />
              <Tooltip
                cursor={{ stroke: '#3182F6', strokeWidth: 1, strokeDasharray: '3 3' }}
                content={({ active, payload }) =>
                  active && payload && payload.length ? (
                    <div className="rounded-lg bg-ink px-2.5 py-1.5 text-[12px] font-semibold text-white shadow-lg">
                      {abbreviateKRW(Number(payload[0].value))}
                    </div>
                  ) : null
                }
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3182F6"
                strokeWidth={2.5}
                fill="url(#assetArea)"
                dot={{ r: 3, fill: '#3182F6', stroke: '#fff', strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: '#3182F6', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex justify-between border-t border-line pt-3 text-[13px]">
          <span className="text-sub">
            자산 <span className="tnum font-semibold text-ink">{formatWon(assets)}</span>
          </span>
          <span className="text-sub">
            부채 <span className="tnum font-semibold text-danger">{formatWon(debts)}</span>
          </span>
        </div>
      </Card>

      {/* 자산 그룹별 리스트 */}
      {groupsWithItems.map(({ group, items }) => (
        <AssetGroupCard key={group} group={group} items={items} />
      ))}

      {/* 부채 */}
      {debtItems.length > 0 && (
        <div className="rounded-card bg-card px-5 py-4 shadow-card">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-danger">부채</h3>
            <span className="tnum text-[15px] font-bold text-danger">−{formatWon(debts)}</span>
          </div>
          <div className="divide-y divide-line/70">
            {debtItems.map((it) => (
              <div key={it.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-[15px] font-medium text-ink">{it.name}</p>
                  {it.owner && <p className="mt-0.5 text-[12px] text-cap">{it.owner}</p>}
                </div>
                <span className="tnum text-[15px] font-semibold text-danger">
                  −{formatWon(it.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 10년 목표 */}
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[15px] font-bold text-ink">10년 목표 순자산</p>
          <span className="tnum text-[14px] font-bold text-brand">{formatPercent(targetRatio)}</span>
        </div>
        <ProgressBar ratio={targetRatio} className="mb-2" />
        <div className="flex justify-between text-[13px] text-sub">
          <span className="tnum">현재 {abbreviateKRW(netWorth)}</span>
          <span className="tnum">목표 {abbreviateKRW(profile.targetNetWorth)}</span>
        </div>
      </Card>
    </div>
  )
}

function AssetGroupCard({
  group,
  items,
}: {
  group: AssetGroup
  items: { id: string; name: string; amount: number; owner?: string }[]
}) {
  const subtotal = items.reduce((acc, it) => acc + it.amount, 0)
  return (
    <div className="rounded-card bg-card px-5 py-4 shadow-card">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-ink">{ASSET_GROUP_LABEL[group]}</h3>
        <span className="tnum text-[15px] font-bold text-ink">{formatWon(subtotal)}</span>
      </div>
      <div className="divide-y divide-line/70">
        {items.map((it) => (
          <div key={it.id} className="flex items-center justify-between py-3">
            <div>
              <p className="text-[15px] font-medium text-ink">{it.name}</p>
              {it.owner && <p className="mt-0.5 text-[12px] text-cap">{it.owner}</p>}
            </div>
            <span className="tnum text-[15px] font-semibold text-ink">{formatWon(it.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
