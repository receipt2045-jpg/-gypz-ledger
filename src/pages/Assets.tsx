import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, ChevronRight, Pencil } from 'lucide-react'
import AssetDonut from '../components/AssetDonut'
import AssetIcon from '../components/AssetIcon'
import Card from '../components/Card'
import InfoTip from '../components/InfoTip'
import ProgressBar from '../components/ProgressBar'
import { useLedgerStore } from '../lib/store'
import {
  netWorthOf,
  netWorthSeries,
  resolveSnapshot,
  totalAssets,
  totalDebts,
} from '../lib/carryover'
import { ownerBadge } from '../lib/memberColors'
import { CURRENCY_SYMBOL, krwOf, useFxRates, type Currency } from '../lib/fx'
import { abbreviateKRW, currentYm, formatComma, formatMonthKorean, formatPercent } from '../lib/format'
import { ASSET_GROUP_LABEL, ASSET_GROUP_ORDER, TERM_TIP } from '../lib/constants'
import type { AssetGroup } from '../types'

export default function Assets() {
  const navigate = useNavigate()
  const { snapshots, profile } = useLedgerStore()
  const rates = useFxRates()
  // 최신 스냅샷 기준
  const latestYm = snapshots.length ? snapshots[snapshots.length - 1].ym : currentYm()

  const storedSnapshot = resolveSnapshot(snapshots, latestYm)
  // 외화 항목을 실시간 환율로 원화 환산한 스냅샷 (현재 화면 기준)
  const snapshot = {
    ...storedSnapshot,
    items: storedSnapshot.items.map((it) => ({ ...it, amount: krwOf(it, rates) })),
  }
  const netWorth = netWorthOf(snapshot)
  const assets = totalAssets(snapshot)
  const debts = totalDebts(snapshot)

  const series = netWorthSeries(snapshots, latestYm, 6).map((d, i, arr) => ({
    ...d,
    // 마지막(현재) 점은 실시간 환율 반영값으로 맞춰 헤더와 일치시킴
    value: i === arr.length - 1 ? netWorth : d.value,
    label: formatMonthKorean(d.ym),
  }))
  const prev = series.length >= 2 ? series[series.length - 2].value : netWorth
  const delta = netWorth - prev
  const up = delta >= 0

  const targetRatio = profile.targetNetWorth > 0 ? netWorth / profile.targetNetWorth : 0

  const assetItems = snapshot.items.filter((it) => it.kind === 'asset')
  const debtItems = snapshot.items.filter((it) => it.kind === 'debt')

  // 소유자별 배지 색: 부부는 각자 고른 색 · 자녀 노랑 · 공동 중립
  const childNames = profile.childNames ?? []
  const ownerBadgeClass = (owner?: string) => ownerBadge(owner, profile, childNames)

  // 구성원별 자산 합계 (자산만, 부채 제외) — 자녀 포함
  const ownerTotals = [profile.member1Name, profile.member2Name, '공동', ...childNames].map(
    (name) => ({
      name,
      total: assetItems
        .filter((it) =>
          name === '공동' ? !it.owner || it.owner === '공동' : it.owner === name,
        )
        .reduce((acc, it) => acc + it.amount, 0),
    }),
  )

  const groupsWithItems = ASSET_GROUP_ORDER.map((g) => ({
    group: g,
    items: assetItems.filter((it) => it.group === g),
  })).filter((x) => x.items.length > 0)

  // 카드 탭 → 해당 소유자의 자산 수정 화면으로 바로 이동
  const editOwner = (owner?: string) =>
    navigate('/asset-setup', { state: { owner: owner ?? '공동' } })

  return (
    <div className="animate-fade-up space-y-4">
      <header className="flex items-center justify-between px-1 pt-2">
        <h1 className="text-[18px] font-bold text-ink">자산</h1>
        <button
          onClick={() => navigate('/asset-setup')}
          className="flex items-center gap-1 rounded-full bg-brand/10 px-3 py-1.5 text-[12px] font-bold text-brand active:bg-brand/20"
        >
          <Pencil size={12} /> 등록·수정
        </button>
      </header>

      {/* 자산이 없으면 등록 안내 */}
      {snapshot.items.length === 0 && (
        <Card onClick={() => navigate('/asset-setup')}>
          <p className="text-[15px] font-bold text-ink">아직 등록된 자산이 없어요</p>
          <p className="mt-1 text-[13px] text-sub">
            어떤 통장에 얼마 있는지 남편·아내 각자 등록해 보세요
          </p>
        </Card>
      )}

      {/* 순자산 요약 */}
      <Card>
        <p className="text-[13px] font-medium text-cap">
          순자산
          <InfoTip text={TERM_TIP.netWorth} />
        </p>
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

      </Card>

      {/* 총자산·순자산·부채 도넛 */}
      {snapshot.items.length > 0 && (
        <Card>
          <p className="mb-3 text-[13px] font-medium text-cap">자산 구성</p>
          <AssetDonut assets={assets} debts={debts} />
        </Card>
      )}

      {/* 구성원별 자산 합계 */}
      {snapshot.items.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {ownerTotals.map(({ name, total }) => (
            <div key={name} className="rounded-card bg-card px-2 py-3 text-center shadow-card">
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ownerBadgeClass(
                  name === '공동' ? undefined : name,
                )}`}
              >
                {name}
              </span>
              <p className="tnum mt-1.5 text-[14px] font-extrabold text-ink">
                {abbreviateKRW(total)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 자산 그룹별 계좌 카드 그리드 */}
      {groupsWithItems.map(({ group, items }) => (
        <AssetGroupSection
          key={group}
          group={group}
          items={items}
          badgeClass={ownerBadgeClass}
          onEdit={editOwner}
        />
      ))}

      {/* 부채 */}
      {debtItems.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-[15px] font-bold text-danger">부채</h3>
            <span className="tnum text-[14px] font-bold text-danger">−{abbreviateKRW(debts)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {debtItems.map((it) => (
              <AccountCard
                key={it.id}
                item={it}
                badgeClass={ownerBadgeClass(it.owner)}
                onEdit={() => editOwner(it.owner)}
                debt
              />
            ))}
          </div>
        </section>
      )}

      {/* 10년 목표 — 탭하면 설정에서 바로 수정 (브리프 P2 3.2) */}
      <Card onClick={() => navigate('/settings')}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[15px] font-bold text-ink">10년 목표 순자산</p>
          <span className="flex items-center gap-0.5 text-[14px] font-bold text-brand">
            <span className="tnum">{formatPercent(targetRatio)}</span>
            <ChevronRight size={16} className="text-cap" />
          </span>
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

function AssetGroupSection({
  group,
  items,
  badgeClass,
  onEdit,
}: {
  group: AssetGroup
  items: AssetItemLike[]
  badgeClass: (owner?: string) => string
  onEdit: (owner?: string) => void
}) {
  const subtotal = items.reduce((acc, it) => acc + it.amount, 0)
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="flex items-center text-[15px] font-bold text-ink">
          {ASSET_GROUP_LABEL[group]}
          {group === 'cash' && <InfoTip text={TERM_TIP.cash} />}
        </h3>
        <span className="tnum text-[14px] font-bold text-sub">{abbreviateKRW(subtotal)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {items.map((it) => (
          <AccountCard
            key={it.id}
            item={it}
            badgeClass={badgeClass(it.owner)}
            onEdit={() => onEdit(it.owner)}
          />
        ))}
      </div>
    </section>
  )
}

interface AssetItemLike {
  id: string
  group: AssetGroup
  kind: 'asset' | 'debt'
  name: string
  amount: number // 실시간 환율로 환산된 원화
  currency?: string
  fxAmount?: number
  owner?: string
}

// 계좌 하나 = 카드 하나: 아이콘 + 이름 + 소유자(색 구분) + 잔액. 탭하면 수정.
function AccountCard({
  item,
  badgeClass,
  onEdit,
  debt,
}: {
  item: AssetItemLike
  badgeClass: string
  onEdit: () => void
  debt?: boolean
}) {
  return (
    <button
      onClick={onEdit}
      className="rounded-card bg-card p-4 text-left shadow-card transition-transform active:scale-[0.97]"
    >
      <div className="flex items-start justify-between">
        <AssetIcon group={item.group} kind={item.kind} size={38} />
        {item.owner && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeClass}`}>
            {item.owner}
          </span>
        )}
      </div>
      <p className="mt-3 truncate text-[13px] font-semibold text-sub">{item.name}</p>
      <p
        className={`tnum mt-0.5 truncate text-[17px] font-extrabold ${debt ? 'text-danger' : 'text-ink'}`}
      >
        {debt ? '−' : ''}
        {abbreviateKRW(item.amount)}
      </p>
      {item.currency && item.currency !== 'KRW' && item.fxAmount != null && (
        <p className="tnum mt-0.5 truncate text-[12px] font-medium text-cap">
          {CURRENCY_SYMBOL[item.currency as Currency]}
          {formatComma(item.fxAmount)}
        </p>
      )}
    </button>
  )
}
