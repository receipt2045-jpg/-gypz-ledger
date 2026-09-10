import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Pencil, Sparkles } from 'lucide-react'
import AmountInput from '../components/AmountInput'
import AssetComposition from '../components/AssetComposition'
import Card from '../components/Card'
import { useLedgerStore } from '../lib/store'
import { resolveLedger, resolveSnapshot, summarize, totalAssets } from '../lib/carryover'
import { abbreviateKRW, currentYm, formatYmKorean, shiftYm } from '../lib/format'
import { PILLAR_INFO, computePillars, diagnose, type Pillars } from '../lib/roadmap'
import {
  STATUS_LABEL,
  paceWithoutIncome,
  planGoal,
  type GoalPlan,
  type GoalStatus,
  type Pace,
} from '../lib/savingsGoal'
import type { MonthlyLedger, SavingsGoal } from '../types'

/**
 * 자산 로드맵 — "얼마를 언제까지"에 지금 속도를 대 본다.
 *
 * 집·집값은 넣지 않는다(2026-09-10). 들어가는 건 사용자가 정한 목표와
 * 정산에서 나온 저축 속도, 지금 자산뿐이라 틀릴 데가 없다.
 * 위에서부터: 상태·D-day → 모을 돈 → 지금 속도면(지렛대 둘 + 슬라이더) →
 * 연도별 → 만약에 → 어디에 담나 → 우리 부부 → (접힌) 우리 팀 상태.
 */

/** 정산의 '부수입' 항목 합 — 저축과 따로 보여주려고 나눈다 */
function sideIncomeOf(ledger: MonthlyLedger): number {
  return ledger.items
    .filter((it) => it.group === 'income' && it.category === '부수입')
    .reduce((a, it) => a + it.actual, 0)
}

/** 구성원별 소득 — '만약에'에서 한 사람 소득을 빼 볼 때 */
function incomeByMember(ledger: MonthlyLedger): [number, number] {
  const out: [number, number] = [0, 0]
  for (const it of ledger.items) {
    if (it.group === 'income') out[it.member - 1] += it.actual
  }
  return out
}

const STATUS_STYLE: Record<GoalStatus, string> = {
  on: 'bg-emerald-50 text-emerald-700',
  slight: 'bg-amber-50 text-amber-700',
  off: 'bg-red-50 text-red-700',
}

export default function Roadmap() {
  const navigate = useNavigate()
  const { ledgers, snapshots, profile, updateProfile } = useLedgerStore()

  const nowYm = currentYm()
  const latestYm = ledgers.length ? ledgers[ledgers.length - 1].ym : nowYm
  const ledger = resolveLedger(ledgers, latestYm)
  const s = summarize(ledger)
  const snapshot = resolveSnapshot(snapshots, latestYm)
  // 진행률은 '자산에 들어간 돈 전부' 기준 — 현금·주식·연금·부동산·소비재 다 합쳐서
  const have = totalAssets(snapshot)
  const assetItems = snapshot.items.filter((it) => it.kind === 'asset')

  const pace: Pace = { monthlySaving: s.saving + s.investment, monthlySide: sideIncomeOf(ledger) }
  const hasIncome = s.income > 0
  const goal = profile.goal
  const [editing, setEditing] = useState(false)

  const pillars = computePillars(ledger, s)
  const diag = diagnose(pillars)

  const saveGoal = (g: SavingsGoal) => {
    updateProfile({
      goal: {
        ...profile.goal,
        ...g,
        createdYm: profile.goal?.createdYm ?? nowYm,
        // 기준점은 처음 세울 때 한 번만 — 고칠 때마다 0%로 돌아가면 안 된다
        baseAssets: profile.goal?.baseAssets ?? have,
      },
    })
    setEditing(false)
  }

  // 기준점 없이 저장된 목표(칸을 나중에 만든 경우)는 지금 자산을 기준으로 한 번 채운다
  useEffect(() => {
    if (goal && goal.baseAssets === undefined) updateProfile({ goal: { ...goal, baseAssets: have } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal?.baseAssets])

  return (
    <div className="animate-fade-up space-y-4 pb-24">
      <header className="px-1 pt-2">
        <h1 className="text-[20px] font-extrabold tracking-tight text-ink">자산 로드맵</h1>
        <p className="mt-1.5 text-[13.5px] font-medium leading-relaxed text-sub">
          얼마를 언제까지 모을지 정하면, 지금 속도로 닿는지 보여드려요.
        </p>
      </header>

      {!hasIncome ? (
        <Card onClick={() => navigate('/monthly')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold text-ink">먼저 이번 달 정산을 해볼까요?</p>
              <p className="mt-1 text-[13px] text-sub">
                수입·저축을 넣어야 지금 속도가 나와요
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-cap" />
          </div>
        </Card>
      ) : !goal || editing ? (
        <>
          <PaceNowCard pace={pace} />
          <GoalForm
            initial={goal}
            nowYm={nowYm}
            onSave={saveGoal}
            onCancel={goal ? () => setEditing(false) : undefined}
          />
        </>
      ) : (
        <GoalView
          goal={goal}
          have={have}
          pace={pace}
          income={s.income}
          incomeByMember={incomeByMember(ledger)}
          memberNames={[profile.member1Name, profile.member2Name]}
          nowYm={nowYm}
          onEdit={() => setEditing(true)}
          onCouple={(patch) => updateProfile({ goal: { ...goal, ...patch } })}
          assetItems={assetItems}
        />
      )}

      {/* 우리 팀 상태 — 목표 뒤로 물러난다. 진단은 목표가 있어야 뜻이 생긴다 */}
      {hasIncome && <PillarsFolded pillars={pillars} headline={diag.headline} />}
    </div>
  )
}

// ── 목표 넣기 전: 지금 속도 ─────────────────────
function PaceNowCard({ pace }: { pace: Pace }) {
  const yearly = (pace.monthlySaving + pace.monthlySide) * 12
  return (
    <Card>
      <p className="text-[13px] font-medium text-cap">지금 속도</p>
      <p className="tnum mt-1 text-[26px] font-extrabold tracking-tight text-ink">
        1년에 {abbreviateKRW(yearly)}
      </p>
      <p className="tnum mt-1 text-[13px] text-sub">
        월 저축 {abbreviateKRW(pace.monthlySaving)}
        {pace.monthlySide > 0 && <> + 부수입 {abbreviateKRW(pace.monthlySide)}</>}
      </p>
    </Card>
  )
}

// ── 목표 입력 (새로 / 고치기) ───────────────────
function GoalForm({
  initial,
  nowYm,
  onSave,
  onCancel,
}: {
  initial?: SavingsGoal
  nowYm: string
  onSave: (g: SavingsGoal) => void
  onCancel?: () => void
}) {
  const [amount, setAmount] = useState(initial?.amount ?? 100_000_000)
  const [targetYm, setTargetYm] = useState(initial?.targetYm ?? shiftYm(nowYm, 36))
  const [name, setName] = useState(initial?.name ?? '')
  const valid = amount > 0 && targetYm > nowYm

  return (
    <Card className="border-2 border-dashed border-pink-300 !bg-pink-50/40">
      <p className="text-[15px] font-bold text-pink-600">
        {initial ? '목표 고치기' : '얼마를 언제까지 모을까요?'}
      </p>
      <p className="mt-1 text-[13px] text-sub">두 칸만 넣으면 닿는 시점을 계산해 드려요</p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-sub">금액</label>
          <AmountInput value={amount} onChange={setAmount} />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-sub">시점</label>
          <input
            type="month"
            value={targetYm}
            min={shiftYm(nowYm, 1)}
            onChange={(e) => e.target.value && setTargetYm(e.target.value)}
            className="tnum w-full rounded-btn border border-line bg-white px-3.5 py-3 text-[15px] text-ink outline-none focus:border-brand"
          />
          {targetYm <= nowYm && (
            <p className="mt-1 text-[12px] text-danger">다음 달 이후로 골라 주세요</p>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-sub">
            이름 <span className="text-cap">(비워도 돼요)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 1억, 아이 학자금"
            maxLength={20}
            className="w-full rounded-btn border border-line bg-white px-3.5 py-3 text-[15px] text-ink outline-none focus:border-brand placeholder:text-cap"
          />
        </div>
      </div>

      <button
        onClick={() => valid && onSave({ amount, targetYm, name: name.trim() || undefined })}
        disabled={!valid}
        className="mt-4 w-full rounded-btn bg-pink-500 py-3.5 text-[15px] font-bold text-white shadow-cta active:bg-pink-600 disabled:opacity-40"
      >
        {initial ? '저장' : '로드맵 만들기'}
      </button>
      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-2 h-10 w-full rounded-btn text-[13.5px] font-semibold text-sub active:bg-line"
        >
          그대로 두기
        </button>
      )}
    </Card>
  )
}

// ── 목표 넣은 뒤 ─────────────────────────────────
function GoalView({
  goal,
  have,
  pace,
  income,
  incomeByMember: byMember,
  memberNames,
  nowYm,
  onEdit,
  onCouple,
  assetItems,
}: {
  goal: SavingsGoal
  have: number
  pace: Pace
  income: number
  incomeByMember: [number, number]
  memberNames: [string, string]
  nowYm: string
  onEdit: () => void
  onCouple: (patch: Partial<SavingsGoal>) => void
  assetItems: Parameters<typeof AssetComposition>[0]['items']
}) {
  // '모을 돈'은 지금 자산 위에 얹는 돈 — 세운 뒤로 늘어난 만큼만 진행으로 센다
  const base = goal.baseAssets ?? have
  const saved = have - base
  const plan = planGoal(saved, goal, pace, nowYm)

  // 슬라이더 — 저축률을 움직이면 D-day가 바뀐다. 기본은 지금 저축률
  const currentRate = income > 0 ? Math.round(((pace.monthlySaving / income) * 100) as number) : 0
  const [rate, setRate] = useState(currentRate)
  const simPace: Pace = {
    monthlySaving: Math.round((income * rate) / 100),
    monthlySide: pace.monthlySide,
  }
  const sim = rate === currentRate ? plan : planGoal(saved, goal, simPace, nowYm)

  return (
    <>
      {/* ① 상태 + D-day — 흰 카드. "괜찮은 거야?"에 한 단어로 답한다 */}
      <Card>
        <span
          className={`inline-block rounded-full px-3 py-1 text-[12.5px] font-bold ${STATUS_STYLE[sim.status]}`}
        >
          {STATUS_LABEL[sim.status]}
        </span>
        <p className="tnum mt-2.5 text-[30px] font-extrabold tracking-tight text-ink">
          {plan.monthsLeft > 0 ? `D-${plan.monthsLeft}개월` : '목표 달이에요'}
        </p>
        <p className="mt-1 text-[13px] text-sub">
          {formatYmKorean(goal.targetYm)}까지 ·{' '}
          <DelayText plan={sim} simulated={rate !== currentRate} />
        </p>
      </Card>

      {/* ② 모을 돈 */}
      <Card>
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-medium text-cap">모을 돈{goal.name ? ` · ${goal.name}` : ''}</p>
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-[12px] font-bold text-cap active:text-ink"
            aria-label="목표 고치기"
          >
            <Pencil size={12} /> 고치기
          </button>
        </div>
        <p className="tnum mt-1 text-[22px] font-extrabold text-ink">
          {abbreviateKRW(goal.amount)}
          <span className="ml-1.5 text-[13px] font-medium text-cap">· {formatYmKorean(goal.targetYm)}까지</span>
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(plan.progress * 100)}%` }} />
        </div>
        <p className="tnum mt-1.5 text-[13px] text-sub">
          세운 뒤 모은 돈 <b className="text-brand">{abbreviateKRW(Math.max(0, saved))}</b>{' '}
          <span className="text-cap">({Math.round(plan.progress * 100)}%)</span>
        </p>
        <p className="tnum mt-0.5 text-[11.5px] text-cap">
          세울 때 자산 {abbreviateKRW(base)} → 지금 {abbreviateKRW(have)}
          {saved < 0 && <span className="text-danger"> · 그새 줄었어요</span>}
        </p>
      </Card>

      {/* ③ 지금 속도면 — 지렛대 둘 + 슬라이더 */}
      <Card>
        <p className="text-[13px] font-medium text-cap">지금 속도면</p>
        <p className="tnum mt-1 text-[18px] font-extrabold text-ink">
          {formatYmKorean(goal.targetYm)}에 <span className="text-brand">{abbreviateKRW(sim.projected)}</span>
        </p>
        {sim.gap > 0 ? (
          <>
            <p className="tnum mt-0.5 text-[14px] font-bold text-pink-600">
              {abbreviateKRW(sim.gap)} 모자라요
            </p>
            {/* 지렛대 — 보여주기만 한다(버튼 아님). 실수로 눌러 목표가 바뀌면 안 된다 */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Lever
                top="월 저축을"
                mid={sim.extraPerMonth !== null ? `+${abbreviateKRW(sim.extraPerMonth)}` : '—'}
                bottom="더 하거나"
              />
              <Lever
                top="시점을"
                mid={sim.delayMonths !== null ? `${sim.delayMonths}개월` : '—'}
                bottom="뒤로 미루거나"
              />
            </div>
          </>
        ) : (
          <p className="mt-0.5 text-[14px] font-bold text-emerald-600">
            이대로면 {sim.reachYm ? formatYmKorean(sim.reachYm) : '제때'}에 닿아요
          </p>
        )}

        <div className="mt-4 border-t border-line pt-3">
          <div className="flex items-center justify-between text-[12px] text-sub">
            {/* 안 움직였을 땐 실제 저축액을 보여준다 — 저축률을 정수로 반올림해 역산하면 307만/310만처럼 어긋난다 */}
            <span className="tnum">
              월 저축{' '}
              <b className="text-ink">
                {abbreviateKRW(rate === currentRate ? pace.monthlySaving : simPace.monthlySaving)}
              </b>{' '}
              · 저축률 {rate}%
            </span>
            <span className="text-cap">움직이면 D-day가 바뀌어요</span>
          </div>
          <input
            type="range"
            min={0}
            max={80}
            step={1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            aria-label="저축률"
            className="mt-2 w-full accent-brand"
          />
          {rate !== currentRate && (
            <button onClick={() => setRate(currentRate)} className="mt-1 text-[12px] font-bold text-brand">
              지금 저축률({currentRate}%)로 되돌리기
            </button>
          )}
        </div>
      </Card>

      {/* ④ 연도별 — 같은 속도라면 */}
      <YearlyCard plan={sim} goalAmount={goal.amount} />

      {/* ⑤ 만약에 — 소득이 있는 사람마다 */}
      <WhatIfCard goal={goal} saved={saved} pace={pace} byMember={byMember} memberNames={memberNames} nowYm={nowYm} />

      {/* ⑥ 어디에 담나 — 자산 화면과 같은 막대 */}
      <AssetComposition items={assetItems} />

      {/* ⑦ 우리 부부 */}
      <CoupleCard goal={goal} memberNames={memberNames} onChange={onCouple} />
    </>
  )
}

function DelayText({ plan, simulated }: { plan: GoalPlan; simulated: boolean }) {
  const lead = simulated ? '이 저축률이면' : '지금 속도면'
  if (plan.delayMonths === null) return <span className="text-danger">저축이 0이라 닿는 날이 없어요</span>
  if (plan.delayMonths === 0) return <span className="text-emerald-600">{lead} 제때 닿아요</span>
  return (
    <span className="text-amber-600">
      {lead} <b>{plan.delayMonths}개월</b> 늦어요
    </span>
  )
}

function Lever({ top, mid, bottom }: { top: string; mid: string; bottom: string }) {
  return (
    <div className="rounded-btn border border-line px-2 py-2.5 text-center">
      <p className="text-[11.5px] text-sub">{top}</p>
      <p className="tnum text-[16px] font-extrabold text-brand">{mid}</p>
      <p className="text-[11.5px] text-sub">{bottom}</p>
    </div>
  )
}

function YearlyCard({ plan, goalAmount }: { plan: GoalPlan; goalAmount: number }) {
  const top = Math.max(goalAmount, ...plan.yearly.map((y) => y.value)) || 1
  const goalPct = Math.round((goalAmount / top) * 100)
  return (
    <Card>
      <p className="text-[13px] font-medium text-cap">
        연도별 <span className="text-cap/70">· 같은 속도라면</span>
      </p>
      <div className="relative mt-3 flex h-28 items-end gap-2.5 pt-4">
        {/* 목표선 — 마지막 막대가 여기 못 닿으면 모자란 것 */}
        <div
          className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-pink-400"
          style={{ bottom: `${goalPct}%` }}
        />
        <span className="tnum absolute right-0 top-0 text-[10.5px] font-bold text-pink-500">
          목표 {abbreviateKRW(goalAmount)}
        </span>
        {plan.yearly.map((y, i) => {
          const last = i === plan.yearly.length - 1
          const pct = Math.max(4, Math.round((y.value / top) * 100))
          return (
            <div key={y.ym} className="flex flex-1 flex-col items-center gap-1">
              <span className="tnum text-[10.5px] text-sub">{abbreviateKRW(y.value)}</span>
              <div
                className={`w-full rounded-t-md ${last ? 'bg-brand/50' : 'bg-brand'}`}
                style={{ height: `${pct}%` }}
              />
              <span className="tnum text-[10.5px] text-cap">
                {i === 0 ? '지금' : y.ym.replace('-', '.')}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function WhatIfCard({
  goal,
  saved,
  pace,
  byMember,
  memberNames,
  nowYm,
}: {
  goal: SavingsGoal
  saved: number // 세운 뒤 모은 돈 — GoalView와 같은 기준
  pace: Pace
  byMember: [number, number]
  memberNames: [string, string]
  nowYm: string
}) {
  const base = planGoal(saved, goal, pace, nowYm)
  const rows = ([0, 1] as const)
    .filter((i) => byMember[i] > 0)
    .map((i) => {
      const cut = paceWithoutIncome(pace, byMember[i])
      const p = planGoal(saved, goal, cut, nowYm)
      const extra =
        p.delayMonths === null || base.delayMonths === null ? null : p.delayMonths - base.delayMonths
      return { name: memberNames[i], saving: cut.monthlySaving, extra, dead: p.delayMonths === null }
    })
  if (rows.length === 0) return null

  return (
    <Card>
      <p className="text-[13px] font-medium text-cap">만약에</p>
      <div className="mt-2 space-y-2">
        {rows.map((r) => (
          <p key={r.name} className="tnum text-[13.5px] leading-relaxed text-sub">
            <b className="text-ink">{r.name}</b> 소득이 멈추면 월 저축{' '}
            <b className="text-ink">
              {abbreviateKRW(pace.monthlySaving)} → {abbreviateKRW(r.saving)}
            </b>
            {r.dead ? (
              <> · <span className="font-bold text-danger">저축이 멈춰요</span></>
            ) : r.extra && r.extra > 60 ? (
              // "464개월 뒤로"는 숫자만 크고 뜻이 없다 — 5년 넘으면 그냥 어렵다고 말한다
              <> · <span className="font-bold text-danger">5년 넘게 늦어져요</span></>
            ) : r.extra && r.extra > 0 ? (
              <> · 시점 <span className="font-bold text-pink-600">{r.extra}개월 뒤로</span></>
            ) : (
              <> · <span className="font-bold text-emerald-600">그래도 제때 닿아요</span></>
            )}
          </p>
        ))}
      </div>
    </Card>
  )
}

function CoupleCard({
  goal,
  memberNames,
  onChange,
}: {
  goal: SavingsGoal
  memberNames: [string, string]
  onChange: (patch: Partial<SavingsGoal>) => void
}) {
  const [role1, setRole1] = useState(goal.role1 ?? '')
  const [role2, setRole2] = useState(goal.role2 ?? '')
  const [reason, setReason] = useState(goal.reason ?? '')
  const field =
    'w-full rounded-btn border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-brand placeholder:text-cap'

  return (
    <Card>
      <p className="text-[13px] font-medium text-cap">우리 부부</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[12px] text-sub">{memberNames[0]}</label>
          <input
            value={role1}
            onChange={(e) => setRole1(e.target.value)}
            onBlur={() => role1 !== (goal.role1 ?? '') && onChange({ role1: role1.trim() || undefined })}
            placeholder="맡는 것"
            maxLength={30}
            className={field}
          />
        </div>
        <div>
          <label className="mb-1 block text-[12px] text-sub">{memberNames[1]}</label>
          <input
            value={role2}
            onChange={(e) => setRole2(e.target.value)}
            onBlur={() => role2 !== (goal.role2 ?? '') && onChange({ role2: role2.trim() || undefined })}
            placeholder="맡는 것"
            maxLength={30}
            className={field}
          />
        </div>
      </div>
      <label className="mb-1 mt-3 block text-[12px] text-sub">이 돈을 모으는 이유</label>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onBlur={() => reason !== (goal.reason ?? '') && onChange({ reason: reason.trim() || undefined })}
        placeholder="한 줄로"
        maxLength={60}
        className={field}
      />
    </Card>
  )
}

// ── 우리 팀 상태 — 접어서 맨 아래 ────────────────
function PillarsFolded({ pillars, headline }: { pillars: Pillars; headline: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span>
          <span className="block text-[15px] font-bold text-ink">우리 팀 상태</span>
          <span className="mt-0.5 block text-[12.5px] text-cap">절약 · 절세 · 부수입 · 투자</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-cap transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          {(Object.keys(PILLAR_INFO) as (keyof Pillars)[]).map((key) => (
            <PillarItem key={key} pillarKey={key} score={pillars[key]} />
          ))}
          <div className="mt-2 flex gap-2 rounded-btn bg-bg p-3">
            <Sparkles size={16} className="mt-0.5 shrink-0 text-brand" />
            <p className="text-[13.5px] font-medium leading-relaxed text-sub">{headline}</p>
          </div>
        </div>
      )}
    </Card>
  )
}

function PillarItem({ pillarKey, score }: { pillarKey: keyof Pillars; score: number }) {
  const [open, setOpen] = useState(false)
  const info = PILLAR_INFO[pillarKey]
  const empty = score === 0
  const tone = info.team === '방어' ? 'bg-brand' : 'bg-ink'

  return (
    <div className="rounded-btn border border-line">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left active:bg-bg"
      >
        <span className="text-[16px]">{info.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13.5px] font-bold text-ink">{info.label}</span>
            <span className="text-[10px] font-bold text-cap">{info.team}</span>
            {empty && <span className="text-[10px] font-bold text-danger">· 비어있음</span>}
          </div>
          <div className="mt-1.5 flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < score ? tone : 'bg-line'}`} />
            ))}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-cap transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="space-y-2 border-t border-line px-3 py-3">
          <InfoLine label="뜻" text={info.what} />
          <InfoLine label="왜 중요해요" text={info.why} />
          <div className="flex items-start gap-1.5 rounded-lg bg-brand/[0.06] px-2.5 py-2">
            <span className="text-[11px] font-bold text-brand">이번 주</span>
            <p className="text-[12.5px] font-medium leading-relaxed text-sub">{info.action}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoLine({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-cap">{label}</p>
      <p className="mt-0.5 text-[13px] leading-relaxed text-sub">{text}</p>
    </div>
  )
}
