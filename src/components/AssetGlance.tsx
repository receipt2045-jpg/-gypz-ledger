import { loanTotals, payoffYm, type LoanPayment } from '../lib/loan'
import Donut from './Donut'
import { Fragment, useState } from 'react'
import { ChevronRight, Pencil } from 'lucide-react'
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

/** 어디를 눌렀는지 — 누구 것·어느 항목·어느 달을 고치러 갈지 (2026-11-17) */
export interface EditTarget {
  owner?: string
  focusId?: string
  /** 보는 달이 앞달에서 이어 온 달이면 id가 달라서 — 이름으로도 찾는다 */
  focusName?: string
  /** 지난달을 고칠 때만 — 없으면 자산 등록 화면이 늘 고치던 달 */
  ym?: string
}

export interface SeriesPoint {
  ym: string
  value: number
  /** 그 달 항목 — 흐름 그래프에서 점을 눌렀을 때 간단히 보여 줄 때 */
  items?: AssetItem[]
}

/**
 * 자산 '한눈에' — 캡처 한 장에 우리집 자산이 다 들어가게.
 * 함께: 전체 자산 기준 그래프(종류별 막대 · 누구 이름으로 · 흐름 · 부채 한 줄).
 * 사람을 고르면: 엑셀처럼 칸 나눈 표.
 *
 * onEdit을 주면 어디를 눌러도 고치러 간다 (2026-11-17 의견: "어디든 눌러도 수정할 수 있게").
 */
export default function AssetGlance({
  items,
  picked,
  owners,
  ym,
  series,
  pc = false,
  onEdit,
}: {
  items: AssetItem[]
  /** null = 함께 */
  picked: string | null
  /** 누구 이름으로 막대에 쓸 순서 (남편 · 아내 · 공동 · 자녀) */
  owners: string[]
  ym: string
  /** 최근 몇 달 전체 자산 (과거 → 지금) */
  series: SeriesPoint[]
  /** 자산 탭 — PC에서 두 칸으로 (공개 뉴스 화면의 작은 미리보기는 한 칸 그대로) */
  pc?: boolean
  onEdit?: (to: EditTarget) => void
}) {
  if (items.length === 0) return null
  const today = new Date()
  const stamp = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`

  return (
    <div className="space-y-2.5">
      {picked ? (
        <MemberTable items={items} picked={picked} ym={ym} onEdit={onEdit} />
      ) : (
        <Together items={items} owners={owners} ym={ym} series={series} pc={pc} onEdit={onEdit} />
      )}
      <p className="pt-1 text-center text-[11.5px] text-cap">
        모아불리 가계부 · {picked ?? '우리집'} · {stamp} 기준
      </p>
    </div>
  )
}

/** 카드 오른쪽 위 '고치기' 표시 — 눌러서 고칠 수 있다는 걸 알려 준다 */
function EditMark() {
  return (
    <span className="flex shrink-0 items-center gap-0.5 text-[11.5px] font-bold text-cap">
      <Pencil size={11} /> 고치기
    </span>
  )
}

function Together({
  items,
  owners,
  ym,
  series,
  pc,
  onEdit,
}: {
  items: AssetItem[]
  owners: string[]
  ym: string
  series: SeriesPoint[]
  pc: boolean
  onEdit?: (to: EditTarget) => void
}) {
  const rows = groupRows(items)
  const total = rows.reduce((a, r) => a + r.amount, 0)
  const debts = items.filter((it) => it.kind === 'debt').reduce((a, it) => a + it.amount, 0)
  const byOwner = ownerRows(items, owners)
  const loans = loanTotals(items)
  const prev = series.length >= 2 ? series[series.length - 2].value : total
  const delta = total - prev
  const ownerColor = (name: string) => OWNER_COLOR[owners.indexOf(name)] ?? OWNER_COLOR[2]

  const total$ = (
    <Card onClick={onEdit ? () => onEdit({}) : undefined}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-medium text-cap">
          {formatYmKorean(ym)} · 우리집 전체 자산
        </p>
        {onEdit && <EditMark />}
      </div>
      <p className="tnum mt-0.5 text-[28px] font-extrabold tracking-tight text-ink">
        {abbreviateKRW(total)}
      </p>
      {delta !== 0 && (
        <p className={`tnum text-[13px] font-semibold ${delta > 0 ? 'text-brand' : 'text-danger'}`}>
          지난달보다 {delta > 0 ? '+' : '−'}
          {abbreviateKRW(Math.abs(delta))}
        </p>
      )}
      {/* 원 그래프 + 옆에 항목 (2026-10-21 의견: 가로 막대 대신 동그라미로) */}
      <div className="mt-3 flex items-center gap-4">
        <Donut
          label="자산 종류별 비율"
          segments={rows.map((r) => ({ value: r.amount, color: r.color }))}
          size={120}
          stroke={20}
        />
        <div className="grid min-w-0 flex-1 grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-2">
          {rows.map((r) => (
            <Fragment key={r.group}>
              <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-ink">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: r.color }}
                />
                {r.label}
              </span>
              <span className="tnum whitespace-nowrap text-right text-[13px] font-bold text-ink">
                {short(r.amount)}
              </span>
              <span className="tnum whitespace-nowrap text-right text-[12px] text-cap">
                {r.pct}%
              </span>
            </Fragment>
          ))}
        </div>
      </div>
    </Card>
  )

  const rest = (
    <>
      {byOwner.length > 1 && (
        <Card>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12.5px] font-medium text-cap">누구 이름으로</p>
            {onEdit && <span className="text-[11.5px] text-cap">이름을 누르면 고쳐요</span>}
          </div>
          <div className="flex h-3.5 overflow-hidden rounded-md">
            {byOwner.map((o) => (
              <div
                key={o.name}
                onClick={onEdit ? () => onEdit({ owner: o.name }) : undefined}
                className={onEdit ? 'cursor-pointer' : undefined}
                style={{ width: `${Math.max(1, o.pct)}%`, background: ownerColor(o.name) }}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 text-[12px] text-sub">
            {byOwner.map((o) => {
              const label = (
                <>
                  <span
                    className="inline-block h-2 w-2 rounded-sm"
                    style={{ background: ownerColor(o.name) }}
                  />
                  {o.name} <b className="tnum font-semibold text-ink">{short(o.amount)}</b>
                </>
              )
              return onEdit ? (
                <button
                  key={o.name}
                  onClick={() => onEdit({ owner: o.name })}
                  aria-label={`${o.name} 자산 고치기`}
                  className="-mx-1 flex items-center gap-1 whitespace-nowrap rounded px-1 py-0.5 active:bg-bg"
                >
                  {label}
                </button>
              ) : (
                <span key={o.name} className="flex items-center gap-1 whitespace-nowrap">
                  {label}
                </span>
              )
            })}
          </div>
        </Card>
      )}

      <Trend series={series} onEdit={onEdit} />

      {debts > 0 && (
        <div
          onClick={onEdit ? () => onEdit({}) : undefined}
          className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-card bg-card px-4 py-3 text-[13px] text-sub shadow-card ${
            onEdit ? 'cursor-pointer active:bg-bg' : ''
          }`}
        >
          <span className="whitespace-nowrap">
            부채 <b className="tnum font-bold text-danger">{short(debts)}</b>
          </span>
          <span className="whitespace-nowrap">
            빼면 순자산 <b className="tnum font-bold text-ink">{short(total - debts)}</b>
          </span>
          {loans.count > 0 && <LoanLine items={items} loans={loans} />}
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

/**
 * 전체 자산 흐름 — 기록이 두 달 이상 있을 때만.
 * 점(또는 아래 달)을 누르면 그 달을 간단히 보여 주고, 거기서 그 달 자산을 고치러 간다 (2026-11-17 의견).
 */
function Trend({ series, onEdit }: { series: SeriesPoint[]; onEdit?: (to: EditTarget) => void }) {
  const [sel, setSel] = useState<string | null>(null)
  const pts = series.filter((p) => p.value > 0)
  if (pts.length < 2) return null
  const W = 300
  const H = 64
  const lo = Math.min(...pts.map((p) => p.value))
  const hi = Math.max(...pts.map((p) => p.value))
  const span = hi - lo || 1
  const x = (i: number) => 12 + (i * (W - 24)) / (pts.length - 1)
  const y = (v: number) => H - 10 - ((v - lo) / span) * (H - 20)
  const change = pts[pts.length - 1].value - pts[0].value
  const selIdx = pts.findIndex((p) => p.ym === sel)
  const toggle = (ym: string) => setSel((cur) => (cur === ym ? null : ym))
  // 달이 많으면 이름은 하나 걸러 (마지막 달·고른 달은 늘)
  const showLabel = (i: number) => pts.length <= 7 || (pts.length - 1 - i) % 2 === 0 || i === selIdx
  const colW = (W - 24) / (pts.length - 1)

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
        {selIdx >= 0 && (
          <line
            x1={x(selIdx)}
            x2={x(selIdx)}
            y1={2}
            y2={H - 2}
            className="stroke-brand/30"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        <polyline
          points={pts.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
          fill="none"
          className="stroke-brand"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
        {pts.map((p, i) =>
          i === selIdx ? (
            <circle
              key={p.ym}
              cx={x(i)}
              cy={y(p.value)}
              r={5}
              className="fill-white stroke-brand"
              strokeWidth={2.5}
            />
          ) : (
            <circle
              key={p.ym}
              cx={x(i)}
              cy={y(p.value)}
              r={i === pts.length - 1 ? 3.6 : 3}
              className="fill-brand"
            />
          ),
        )}
        {/* 점이 작아 손가락으로 맞히기 어렵다 — 달마다 세로로 넓게 눌리는 칸 */}
        {pts.map((p, i) => (
          <rect
            key={`hit-${p.ym}`}
            x={x(i) - colW / 2}
            y={0}
            width={colW}
            height={H}
            fill="transparent"
            className="cursor-pointer"
            onClick={() => toggle(p.ym)}
          />
        ))}
      </svg>
      <div className="relative h-5 text-[11px]">
        {pts.map((p, i) => (
          <button
            key={p.ym}
            onClick={() => toggle(p.ym)}
            aria-label={`${formatYmKorean(p.ym)} 자산 보기`}
            aria-pressed={i === selIdx}
            className={`absolute top-0 -translate-x-1/2 whitespace-nowrap rounded px-1 ${
              i === selIdx ? 'bg-brand/10 font-bold text-brand' : 'text-cap'
            }`}
            style={{ left: `${(x(i) / W) * 100}%` }}
          >
            {showLabel(i) ? formatMonthKorean(p.ym) : '·'}
          </button>
        ))}
      </div>
      {selIdx >= 0 ? (
        <MonthBrief
          p={pts[selIdx]}
          prev={selIdx > 0 ? pts[selIdx - 1] : null}
          latest={selIdx === pts.length - 1}
          onEdit={onEdit}
        />
      ) : (
        <p className="mt-1 text-center text-[11.5px] text-cap">
          점을 누르면 그 달 자산을 볼 수 있어요
        </p>
      )}
    </Card>
  )
}

/** 흐름에서 고른 달 — 전체 자산, 지난달과 차이, 종류별, 부채 한 줄씩 */
function MonthBrief({
  p,
  prev,
  latest,
  onEdit,
}: {
  p: SeriesPoint
  prev: SeriesPoint | null
  latest: boolean
  onEdit?: (to: EditTarget) => void
}) {
  const its = p.items ?? []
  const rows = groupRows(its)
  const debts = its.filter((it) => it.kind === 'debt').reduce((a, it) => a + it.amount, 0)
  const diff = prev ? p.value - prev.value : 0
  return (
    <div className="mt-2 rounded-btn bg-bg px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-bold text-ink">{formatYmKorean(p.ym)} 전체 자산</p>
        {prev && diff !== 0 && (
          <p
            className={`tnum text-[12px] font-semibold ${diff > 0 ? 'text-brand' : 'text-danger'}`}
          >
            지난달보다 {diff > 0 ? '+' : '−'}
            {short(Math.abs(diff))}
          </p>
        )}
      </div>
      <p className="tnum mt-0.5 text-[20px] font-extrabold text-ink">{abbreviateKRW(p.value)}</p>
      {rows.length > 0 && (
        <p className="tnum mt-1 text-[12px] leading-relaxed text-sub">
          {/* 금액 중간에서 줄이 끊기지 않게 항목마다 묶는다 */}
          {rows.map((r, i) => (
            <Fragment key={r.group}>
              {i > 0 && ' · '}
              <span className="whitespace-nowrap">
                {r.label} {short(r.amount)}
              </span>
            </Fragment>
          ))}
        </p>
      )}
      {debts > 0 && (
        <p className="tnum text-[12px] text-sub">
          부채 {short(debts)} · 순자산 {short(p.value - debts)}
        </p>
      )}
      {onEdit && (
        <button
          onClick={() => onEdit(latest ? {} : { ym: p.ym })}
          className="mt-2.5 flex w-full items-center justify-center gap-0.5 rounded-btn bg-white py-2 text-[12.5px] font-bold text-brand shadow-card active:bg-line"
        >
          {formatMonthKorean(p.ym)} 자산 고치기 <ChevronRight size={14} />
        </button>
      )}
    </div>
  )
}

function MemberTable({
  items,
  picked,
  ym,
  onEdit,
}: {
  items: AssetItem[]
  picked: string
  ym: string
  onEdit?: (to: EditTarget) => void
}) {
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

  // 줄을 누르면 그 사람 자산 등록 화면에서 그 항목으로 바로 간다
  const row = (r: TableRow, i: number, debt = false) => (
    <tr
      key={`${r.label}-${r.name}-${i}`}
      onClick={
        onEdit ? () => onEdit({ owner: picked, focusId: r.id, focusName: r.name }) : undefined
      }
      className={`${debt ? 'text-danger' : 'text-ink'} ${onEdit ? 'cursor-pointer active:bg-bg' : ''}`}
    >
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
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
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
      {onEdit && (
        <button
          onClick={() => onEdit({ owner: picked })}
          className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-btn bg-bg py-2 text-[12.5px] font-bold text-sub active:bg-line"
        >
          <Pencil size={12} /> {picked} 자산 고치기 · 줄을 눌러도 돼요
        </button>
      )}
    </Card>
  )
}

/** 부채 줄 아래 — 대출 정보를 넣은 집만 (2026-10-07) */
function LoanLine({
  items,
  loans,
}: {
  items: AssetItem[]
  loans: LoanPayment & { count: number }
}) {
  const one = items.filter((it) => it.kind === 'debt' && it.loan && it.amount > 0)
  const payoff = one.length === 1 ? payoffYm(one[0].loan!, new Date()) : null
  return (
    <div className="mt-1 w-full border-t border-bg pt-2">
      <p className="flex justify-between">
        <span>대출 갚는 돈 매달</span>
        <b className="tnum font-bold text-ink">{short(loans.payment)}원</b>
      </p>
      <p className="mt-0.5 text-[11.5px] text-cap">
        원금 {short(loans.principal)}씩 갚는 날마다 자동으로 줄어요
        {payoff ? ` · 다 갚는 달 ${formatYmKorean(payoff)}` : ''}
      </p>
    </div>
  )
}
