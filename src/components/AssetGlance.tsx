import { Fragment } from 'react'
import Card from './Card'
import PcColumns from './PcColumns'
import { groupRows, isOwned, memberTable, ownerRows, type TableRow } from '../lib/assetGlance'
import { abbreviateKRW, formatMonthKorean, formatYmKorean } from '../lib/format'
import type { AssetItem } from '../types'

/** 3억 9,510만원 → 3억 9,510만 (칸이 좁은 곳) */
const short = (n: number) => abbreviateKRW(n).replace(/원$/, '')
/** 표는 만원 단위 숫자만 */
const man = (n: number) => Math.round(n / 10_000).toLocaleString('ko-KR')

const OWNER_COLOR = ['#3182F6', '#E0458A', '#D3D1C7', '#EF9F27', '#1D9E75']

/**
 * 자산 '한눈에' — 캡처 한 장에 우리집 자산이 다 들어가게.
 * 함께: 전체 자산 기준 그래프(종류별 막대 · 누구 이름으로 · 흐름 · 부채 한 줄).
 * 사람을 고르면: 엑셀처럼 칸 나눈 표.
 */
export default function AssetGlance({
  items,
  picked,
  owners,
  ym,
  series,
  pc = false,
}: {
  items: AssetItem[]
  /** null = 함께 */
  picked: string | null
  /** 누구 이름으로 막대에 쓸 순서 (남편 · 아내 · 공동 · 자녀) */
  owners: string[]
  ym: string
  /** 최근 몇 달 전체 자산 (과거 → 지금) */
  series: { ym: string; value: number }[]
  /** 자산 탭 — PC에서 두 칸으로 (공개 뉴스 화면의 작은 미리보기는 한 칸 그대로) */
  pc?: boolean
}) {
  if (items.length === 0) return null
  const today = new Date()
  const stamp = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`

  return (
    <div className="space-y-2.5">
      {picked ? (
        <MemberTable items={items} picked={picked} ym={ym} />
      ) : (
        <Together items={items} owners={owners} ym={ym} series={series} pc={pc} />
      )}
      <p className="pt-1 text-center text-[11.5px] text-cap">
        모아불리 가계부 · {picked ?? '우리집'} · {stamp} 기준
      </p>
    </div>
  )
}

function Together({
  items,
  owners,
  ym,
  series,
  pc,
}: {
  items: AssetItem[]
  owners: string[]
  ym: string
  series: { ym: string; value: number }[]
  pc: boolean
}) {
  const rows = groupRows(items)
  const total = rows.reduce((a, r) => a + r.amount, 0)
  const max = Math.max(1, ...rows.map((r) => r.amount))
  const debts = items.filter((it) => it.kind === 'debt').reduce((a, it) => a + it.amount, 0)
  const byOwner = ownerRows(items, owners)
  const prev = series.length >= 2 ? series[series.length - 2].value : total
  const delta = total - prev

  const total$ = (
    <Card>
      <p className="text-[12.5px] font-medium text-cap">{formatYmKorean(ym)} · 우리집 전체 자산</p>
      <p className="tnum mt-0.5 text-[28px] font-extrabold tracking-tight text-ink">
        {abbreviateKRW(total)}
      </p>
      {delta !== 0 && (
        <p className={`tnum text-[13px] font-semibold ${delta > 0 ? 'text-brand' : 'text-danger'}`}>
          지난달보다 {delta > 0 ? '+' : '−'}
          {abbreviateKRW(Math.abs(delta))}
        </p>
      )}
      {/* 모든 줄이 칸 하나를 같이 쓴다 — 금액이 길어도(11억 2,000만) 줄바꿈 없이, 막대가 대신 줄어든다 */}
      <div className="mt-3 grid grid-cols-[auto_minmax(24px,1fr)_auto_auto] items-center gap-x-2 gap-y-2.5">
        {rows.map((r) => (
          <Fragment key={r.group}>
            <span className="whitespace-nowrap text-[13px] font-medium text-ink">
              {r.emoji} {r.label}
            </span>
            <div className="h-2.5 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, (r.amount / max) * 100)}%`, background: r.color }}
              />
            </div>
            <span className="tnum whitespace-nowrap text-right text-[13px] font-bold text-ink">
              {short(r.amount)}
            </span>
            <span className="tnum whitespace-nowrap text-right text-[12px] text-cap">{r.pct}%</span>
          </Fragment>
        ))}
      </div>
    </Card>
  )

  const rest = (
    <>
      {byOwner.length > 1 && (
        <Card>
          <p className="mb-2 text-[12.5px] font-medium text-cap">누구 이름으로</p>
          <div className="flex h-3.5 overflow-hidden rounded-md">
            {byOwner.map((o) => (
              <div
                key={o.name}
                style={{
                  width: `${Math.max(1, o.pct)}%`,
                  background: OWNER_COLOR[owners.indexOf(o.name)] ?? OWNER_COLOR[2],
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[12px] text-sub">
            {byOwner.map((o) => (
              <span key={o.name} className="flex items-center gap-1 whitespace-nowrap">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: OWNER_COLOR[owners.indexOf(o.name)] ?? OWNER_COLOR[2] }}
                />
                {o.name} <b className="tnum font-semibold text-ink">{short(o.amount)}</b>
              </span>
            ))}
          </div>
        </Card>
      )}

      <Trend series={series} />

      {debts > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-card bg-card px-4 py-3 text-[13px] text-sub shadow-card">
          <span className="whitespace-nowrap">
            부채 <b className="tnum font-bold text-danger">{short(debts)}</b>
          </span>
          <span className="whitespace-nowrap">
            빼면 순자산 <b className="tnum font-bold text-ink">{short(total - debts)}</b>
          </span>
        </div>
      )}
    </>
  )

  // PC: 왼쪽 전체 자산·종류별, 오른쪽 누구 이름으로·흐름·부채 (2026-10-06)
  return pc ? (
    <PcColumns left={total$} right={rest} />
  ) : (
    <>
      {total$}
      {rest}
    </>
  )
}

/** 전체 자산 흐름 — 기록이 두 달 이상 있을 때만 */
function Trend({ series }: { series: { ym: string; value: number }[] }) {
  const pts = series.filter((p) => p.value > 0)
  if (pts.length < 2) return null
  const W = 300
  const H = 56
  const lo = Math.min(...pts.map((p) => p.value))
  const hi = Math.max(...pts.map((p) => p.value))
  const span = hi - lo || 1
  const x = (i: number) => 10 + (i * (W - 20)) / (pts.length - 1)
  const y = (v: number) => H - 8 - ((v - lo) / span) * (H - 16)
  const change = pts[pts.length - 1].value - pts[0].value
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] font-medium text-cap">전체 자산 흐름</p>
        {change !== 0 && (
          <p
            className={`tnum text-[12px] font-semibold ${change > 0 ? 'text-brand' : 'text-danger'}`}
          >
            {pts.length}개월 {change > 0 ? '+' : '−'}
            {short(Math.abs(change))}
          </p>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 block w-full"
        role="img"
        aria-label="전체 자산 흐름"
      >
        <polyline
          points={pts.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
          fill="none"
          className="stroke-brand"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {pts.map((p, i) => (
          <circle
            key={p.ym}
            cx={x(i)}
            cy={y(p.value)}
            r={i === pts.length - 1 ? 3.6 : 3}
            className="fill-brand"
          />
        ))}
      </svg>
      <div className="flex justify-between px-0.5 text-[11px] text-cap">
        {pts.map((p) => (
          <span key={p.ym}>{formatMonthKorean(p.ym)}</span>
        ))}
      </div>
    </Card>
  )
}

function MemberTable({ items, picked, ym }: { items: AssetItem[]; picked: string; ym: string }) {
  const mine = items.filter((it) => isOwned(it.owner, picked))
  const t = memberTable(mine)
  const shared =
    picked === '공동'
      ? 0
      : items
          .filter((it) => it.kind === 'asset' && isOwned(it.owner, '공동'))
          .reduce((a, it) => a + it.amount, 0)
  const cell = 'border border-[#D9DEE4] px-2 py-1.5'
  const num = `${cell} tnum text-right`

  const row = (r: TableRow, i: number, debt = false) => (
    <tr key={`${r.label}-${r.name}-${i}`} className={debt ? 'text-danger' : 'text-ink'}>
      <td className={`${cell} truncate`}>{r.label}</td>
      <td className={`${cell} truncate`}>{r.name}</td>
      <td className={num}>
        {debt ? '−' : ''}
        {man(r.amount)}
      </td>
      <td className={`${num} text-sub`}>{r.pct === null ? '' : `${r.pct}%`}</td>
    </tr>
  )

  return (
    <Card>
      <div className="mb-2.5 flex items-baseline justify-between">
        <p className="text-[15px] font-bold text-ink">{picked} 자산표</p>
        <p className="text-[12px] text-cap">{formatYmKorean(ym)} · 단위 만원</p>
      </div>
      <table className="w-full table-fixed border-collapse text-[13px]">
        <colgroup>
          <col className="w-[20%]" />
          <col className="w-[40%]" />
          <col className="w-[24%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead>
          <tr className="bg-[#EEF1F5] text-[12px] text-sub">
            <th className={`${cell} font-semibold`}>종류</th>
            <th className={`${cell} font-semibold`}>항목</th>
            <th className={`${cell} font-semibold`}>금액</th>
            <th className={`${cell} font-semibold`}>비중</th>
          </tr>
        </thead>
        <tbody>
          {t.assets.map((r, i) => row(r, i))}
          <tr className="bg-brand/10 font-bold text-brand">
            <td className={cell} colSpan={2}>
              자산 합계
            </td>
            <td className={num}>{man(t.assetTotal)}</td>
            <td className={num}>{t.assets.length ? '100%' : ''}</td>
          </tr>
          {t.debts.map((r, i) => row(r, i, true))}
          <tr className="bg-[#F7F8FA] font-bold">
            <td className={cell} colSpan={2}>
              순자산
            </td>
            <td className={`${num} ${t.net < 0 ? 'text-danger' : 'text-ink'}`}>
              {t.net < 0 ? '−' : ''}
              {man(Math.abs(t.net))}
            </td>
            <td className={cell} />
          </tr>
        </tbody>
      </table>
      {shared > 0 && (
        <p className="mt-2.5 text-[12px] text-cap">
          공동 자산 {abbreviateKRW(shared)}은 '공동'에서 따로 봐요
        </p>
      )}
    </Card>
  )
}
