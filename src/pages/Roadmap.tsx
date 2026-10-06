import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import AmountInput from '../components/AmountInput'
import PcShell from '../components/PcShell'
import { useIsPc } from '../lib/useIsPc'
import { useLedgerStore } from '../lib/store'
import { genId, netWorthOf, resolveSnapshot } from '../lib/carryover'
import { abbreviateKRW, currentYm, shiftYm } from '../lib/format'
import {
  EVENT_META,
  GROWTH_PRESETS,
  RETURN_PRESETS,
  buildTimeline,
  compactKRW,
  computeRoadmap,
  monthsBetween,
  roadmapInput,
  type TimelineRow,
} from '../lib/roadmap'
import { RULES } from '../lib/parentalLeave'
import type { Roadmap as RoadmapData, RoadmapEvent, RoadmapEventKind } from '../types'

/**
 * 자산 로드맵 (2026-10-06 타임라인으로) — 설정·홈 목표 카드에서 들어온다. 탭에는 두지 않는다.
 *
 * 그래프+입력칸 버전은 계산기 같았고, 맨 위에 '30억까지 17년 늦어요'가 떠서 열 때마다 혼났다.
 * 이제 맨 위는 바로 다음 목표(5억까지 몇 년), 가운데는 연도별 길(그해 재산·계획·마일스톤),
 * 숫자 설정은 맨 아래 한 줄 → 시트. 한 달에 모을 돈을 아직 안 적었으면 예시 숫자로 길을 먼저 그려 준다.
 */
const EXAMPLE_SAVING = 2_000_000
const EXAMPLE_TARGET = 3_000_000_000

export default function Roadmap() {
  const navigate = useNavigate()
  const { profile, snapshots, updateProfile } = useLedgerStore()
  const roadmap: RoadmapData = profile.roadmap ?? { events: [] }
  const setRoadmap = (patch: Partial<RoadmapData>) =>
    updateProfile({ roadmap: { ...roadmap, ...patch } })

  const nowYm = currentYm()
  const netWorth = netWorthOf(resolveSnapshot(snapshots, nowYm))
  const isExample = !(roadmap.monthlySaving && roadmap.monthlySaving > 0)
  const real = roadmapInput(profile, netWorth, nowYm)
  const input = isExample
    ? { ...real, monthlySaving: EXAMPLE_SAVING, target: real.target || EXAMPLE_TARGET }
    : real
  const key = JSON.stringify(input)
  const result = useMemo(() => computeRoadmap(input), [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => buildTimeline(input, result), [key, result]) // eslint-disable-line react-hooks/exhaustive-deps
  const names: [string, string] = [profile.member1Name, profile.member2Name]

  const pc = useIsPc()
  const [sheet, setSheet] = useState<RoadmapEvent | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const saveEvent = (ev: RoadmapEvent) => {
    const exists = roadmap.events.some((e) => e.id === ev.id)
    const events = exists
      ? roadmap.events.map((e) => (e.id === ev.id ? ev : e))
      : [...roadmap.events, ev]
    setRoadmap({ events: events.sort((a, b) => a.ym.localeCompare(b.ym)) })
    setSheet(null)
  }
  const deleteEvent = (id: string) => {
    setRoadmap({ events: roadmap.events.filter((e) => e.id !== id) })
    setSheet(null)
  }

  return (
    <PcShell active="/assets">
      <div className="min-h-screen bg-bg pb-16">
        <div className="mx-auto w-full max-w-app lg:max-w-[1040px] lg:px-5 lg:pt-5">
          <div className="flex items-center gap-1 px-3 pt-3">
            <button
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-sub active:bg-line"
              aria-label="뒤로"
            >
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-[18px] font-bold text-ink">우리집 로드맵</h1>
          </div>

          {/* PC: 왼쪽 넓게 '가는 길', 오른쪽은 다음 목표·계산 기준이 스크롤해도 붙어 있다 (2026-10-06) */}
          {pc ? (
            <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-5 px-5 pt-3">
              <div>
                <Box>
                  <h2 className="mb-4 text-[15px] font-bold text-ink">우리집이 가는 길</h2>
                  {rows.map((row, i) => (
                    <Step
                      key={row.kind === 'year' ? row.year : `q${row.from}`}
                      row={row}
                      last={i === rows.length - 1}
                      target={input.target}
                      extraNeeded={result.extraNeeded}
                      names={names}
                      onEvent={setSheet}
                    />
                  ))}
                  <button
                    onClick={() => setSheet(newEvent('house', nowYm))}
                    className="mt-1 flex w-full items-center justify-center gap-1 rounded-btn border-[1.5px] border-dashed border-line py-3 text-[13px] font-bold text-brand active:bg-bg"
                  >
                    <Plus size={15} /> 길에 계획 넣기
                  </button>
                </Box>
              </div>
              <aside className="sticky top-6 space-y-3">
                <NextGoal
                  netWorth={netWorth}
                  target={input.target}
                  result={result}
                  isExample={isExample}
                  onSetup={() => setSettingsOpen(true)}
                />
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="flex w-full items-center justify-between rounded-card bg-card p-5 text-left shadow-card active:bg-bg"
                >
                  <span>
                    <span className="block text-[14px] font-bold text-ink">계산 기준</span>
                    <span className="mt-0.5 block text-[12px] text-cap">
                      {isExample
                        ? '아직 우리집 숫자를 안 넣었어요'
                        : `월 ${short(input.monthlySaving)} 모으기 · 연 ${Math.round(input.returnRate * 100)}% 불리기 · 목표 ${short(input.target)}`}
                    </span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-cap" />
                </button>
                <p className="px-1 pt-1 text-center text-[11.5px] leading-relaxed text-cap">
                  방향을 잡기 위한 예상이에요. 집을 사면 취득세·중개비 3%와 대출 이자(연 4%)를,
                  아이는 양육비에서 부모급여·아동수당을 뺀 만큼을 반영해요.
                </p>
              </aside>
            </div>
          ) : (
            <div className="space-y-3 px-5 pt-3">
              <NextGoal
                netWorth={netWorth}
                target={input.target}
                result={result}
                isExample={isExample}
                onSetup={() => setSettingsOpen(true)}
              />
              <Box>
                <h2 className="mb-4 text-[15px] font-bold text-ink">우리집이 가는 길</h2>
                {rows.map((row, i) => (
                  <Step
                    key={row.kind === 'year' ? row.year : `q${row.from}`}
                    row={row}
                    last={i === rows.length - 1}
                    target={input.target}
                    extraNeeded={result.extraNeeded}
                    names={names}
                    onEvent={setSheet}
                  />
                ))}
                <button
                  onClick={() => setSheet(newEvent('house', nowYm))}
                  className="mt-1 flex w-full items-center justify-center gap-1 rounded-btn border-[1.5px] border-dashed border-line py-3 text-[13px] font-bold text-brand active:bg-bg"
                >
                  <Plus size={15} /> 길에 계획 넣기
                </button>
              </Box>
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex w-full items-center justify-between rounded-card bg-card p-5 text-left shadow-card active:bg-bg"
              >
                <span>
                  <span className="block text-[14px] font-bold text-ink">계산 기준</span>
                  <span className="mt-0.5 block text-[12px] text-cap">
                    {isExample
                      ? '아직 우리집 숫자를 안 넣었어요'
                      : `월 ${short(input.monthlySaving)} 모으기 · 연 ${Math.round(input.returnRate * 100)}% 불리기 · 목표 ${short(input.target)}`}
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-cap" />
              </button>
              <p className="px-1 pt-1 text-center text-[11.5px] leading-relaxed text-cap">
                방향을 잡기 위한 예상이에요. 집을 사면 취득세·중개비 3%와 대출 이자(연 4%)를, 아이는
                양육비에서 부모급여·아동수당을 뺀 만큼을 반영해요.
              </p>
            </div>
          )}
        </div>

        {sheet && (
          <EventSheet
            initial={sheet}
            isNew={!roadmap.events.some((e) => e.id === sheet.id)}
            names={names}
            childNames={profile.childNames ?? []}
            onClose={() => setSheet(null)}
            onSave={saveEvent}
            onDelete={deleteEvent}
          />
        )}

        {settingsOpen && (
          <Sheet title="계산 기준" onClose={() => setSettingsOpen(false)}>
            <Label>모으고 싶은 돈 · 빚을 빼고 남는 재산 기준</Label>
            <AmountInput
              value={profile.targetNetWorth}
              onChange={(n) => updateProfile({ targetNetWorth: n })}
            />
            <Label>언제까지 모을까요</Label>
            <select
              value={Number(real.targetYm.slice(0, 4))}
              onChange={(e) => setRoadmap({ targetYear: Number(e.target.value) })}
              className={TEXT_INPUT}
            >
              {Array.from({ length: 31 }, (_, i) => Number(nowYm.slice(0, 4)) + i).map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <Label>한 달에 모을 돈 · 저축·투자에 넣을 돈</Label>
            <AmountInput
              value={roadmap.monthlySaving ?? 0}
              onChange={(n) => setRoadmap({ monthlySaving: n })}
            />
            {/* 월소득은 육아휴직 계획에만 쓰여서, 그 계획이 있을 때만 묻는다 */}
            {roadmap.events.some((e) => e.kind === 'leave') &&
              ([1, 2] as const).map((m) => (
                <div key={m}>
                  <Label>{names[m - 1]} 한 달 수입 · 육아휴직 때 줄어드는 돈 계산용</Label>
                  <AmountInput
                    value={(m === 1 ? roadmap.income1 : roadmap.income2) ?? 0}
                    onChange={(n) => setRoadmap(m === 1 ? { income1: n } : { income2: n })}
                  />
                </div>
              ))}
            <div className="mt-4 flex items-center justify-between rounded-btn bg-bg px-3.5 py-3">
              <span className="text-[13px] text-sub">지금 우리집 재산</span>
              <button
                onClick={() => navigate('/asset-setup')}
                className="flex items-center gap-0.5 text-[14px] font-bold text-ink"
              >
                {abbreviateKRW(netWorth)}
                <ChevronRight size={15} className="text-cap" />
              </button>
            </div>
            <Label>모은 돈이 1년에 불어나는 정도</Label>
            <Chips
              options={RETURN_PRESETS.map((p) => ({
                key: p.rate,
                label: `${p.label} ${Math.round(p.rate * 100)}%`,
              }))}
              value={real.returnRate}
              onPick={(rate) => setRoadmap({ returnRate: rate })}
            />
            <Label>월급이 1년에 오르는 정도 · 모을 돈도 같이 늘어요</Label>
            <Chips
              options={GROWTH_PRESETS.map((g) => ({ key: g, label: `${Math.round(g * 100)}%` }))}
              value={real.incomeGrowth}
              onPick={(g) => setRoadmap({ incomeGrowth: g })}
            />
            <button
              onClick={() => setRoadmap({ realTerms: !real.realTerms })}
              className="mt-4 flex w-full items-center justify-between"
              role="switch"
              aria-checked={real.realTerms}
            >
              <span className="text-left">
                <span className="block text-[14px] text-sub">물가 빼고 보기</span>
                <span className="block text-[12px] text-cap">
                  물가가 오르는 만큼 빼고, 지금 돈 가치로 보여줘요
                </span>
              </span>
              <span
                className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${real.realTerms ? 'bg-brand' : 'bg-line'}`}
              >
                <span
                  className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all ${real.realTerms ? 'right-[3px]' : 'left-[3px]'}`}
                />
              </span>
            </button>
            <button
              onClick={() => setSettingsOpen(false)}
              className="mt-5 w-full rounded-btn bg-brand py-3.5 text-[15px] font-bold text-white active:bg-brand-dark"
            >
              다 됐어요
            </button>
          </Sheet>
        )}
      </div>
    </PcShell>
  )
}

/* ───────── 맨 위: 다음 목표 ───────── */

function NextGoal({
  netWorth,
  target,
  result,
  isExample,
  onSetup,
}: {
  netWorth: number
  target: number
  result: ReturnType<typeof computeRoadmap>
  isExample: boolean
  onSetup: () => void
}) {
  const nowYm = currentYm()
  const example = isExample && (
    <button
      onClick={onSetup}
      className="mb-3 flex w-full items-center justify-between gap-2 rounded-btn bg-brand/10 px-3.5 py-2.5 text-left"
    >
      <span className="text-[12.5px] leading-snug text-brand">
        예시예요. 한 달 {short(EXAMPLE_SAVING)} 원씩 모은다고 하고 그렸어요.
      </span>
      <span className="flex shrink-0 items-center text-[12.5px] font-bold text-brand">
        우리집 숫자로 <ChevronRight size={14} />
      </span>
    </button>
  )

  if (netWorth >= target) {
    return (
      <Box>
        {example}
        <p className="text-[20px] font-extrabold text-ink">
          <span className="text-brand">{short(target)}</span>, 이미 도착했어요 🎉
        </p>
        <p className="mt-1 text-[13px] text-sub">계산 기준에서 다음 목표를 올려 보세요.</p>
      </Box>
    )
  }

  // 바로 다음 마일스톤. 없으면 목표 자체
  const next = result.milestones[0] ?? { amount: target, ym: result.reachYm }
  const isFinal = next.amount === target
  const months = next.ym ? monthsBetween(nowYm, next.ym) : null
  const ratio = Math.min(1, Math.max(0, netWorth / next.amount))
  return (
    <Box>
      {example}
      <p className="text-[12px] text-cap">{isFinal ? '목표' : '다음 목표'}</p>
      <p className="mt-1 text-[22px] font-extrabold leading-snug text-ink">
        <span className="text-brand">{short(next.amount)}</span>
        {months === null
          ? '까지는 아직 멀어요'
          : months <= 0
            ? ', 이번 달 도착'
            : `까지 ${spanText(months)}`}
      </p>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-brand"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[12px] text-cap">
        <span>지금 {compactKRW(netWorth)}</span>
        {next.ym && <span>{ymText(next.ym)}쯤</span>}
      </div>
      {!isFinal && (
        <p className="mt-3 border-t border-line pt-3 text-[13px] text-sub">
          큰 목표 <b className="text-ink">{short(target)}</b>은{' '}
          {result.reachYm ? (
            <>
              이 속도면 <b className="text-ink">{result.reachYm.slice(0, 4)}년</b>쯤이에요
            </>
          ) : (
            '지금 속도로는 40년 넘게 걸려요'
          )}
        </p>
      )}
    </Box>
  )
}

/* ───────── 가운데: 연도별 길 ───────── */

function Step({
  row,
  last,
  target,
  extraNeeded,
  names,
  onEvent,
}: {
  row: TimelineRow
  last: boolean
  target: number
  extraNeeded: number
  names: [string, string]
  onEvent: (ev: RoadmapEvent) => void
}) {
  if (row.kind === 'quiet') {
    const label = row.to > row.from ? `${row.from} – ${row.to}` : String(row.from)
    return (
      <div className="flex gap-3">
        <Rail dot="h-2.5 w-2.5 bg-line" line={last ? null : 'dash'} />
        <div className="flex-1 pb-4">
          <p className="tnum text-[13px] font-bold text-cap">{label}</p>
          <p className="mt-0.5 text-[12.5px] text-cap">
            {row.perYear >= 0
              ? `조용히 모으는 해 · 1년에 ${compactKRW(row.perYear)}씩`
              : `나가는 돈이 많은 해 · 1년에 ${compactKRW(-row.perYear)}씩 줄어요`}
          </p>
        </div>
      </div>
    )
  }

  const dot = row.isTarget
    ? 'h-4 w-4 bg-danger'
    : row.isNow
      ? 'h-3 w-3 bg-ink'
      : 'h-3 w-3 border-[2.5px] border-brand bg-white'
  return (
    <div className="flex gap-3">
      <Rail dot={dot} line={last ? null : 'solid'} />
      <div className="min-w-0 flex-1 pb-5">
        <p className={`tnum text-[13px] font-bold ${row.isTarget ? 'text-danger' : 'text-cap'}`}>
          {row.year}
          {row.isNow && ' · 지금'}
          {row.isTarget && ' · 목표한 해'}
        </p>
        <p className="tnum mt-0.5 text-[17px] font-extrabold text-ink">
          {compactKRW(row.value)}
          {row.isTarget && (
            <span className="text-[13px] font-semibold text-cap"> / {short(target)}</span>
          )}
        </p>
        {(row.events.length > 0 || row.milestones.length > 0 || row.reached) && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {row.events.map((ev) => (
              <button
                key={ev.id}
                onClick={() => onEvent(ev)}
                className="flex items-center gap-1 rounded-[10px] bg-bg px-2.5 py-1.5 text-[12.5px] font-bold text-sub active:bg-line"
              >
                {EVENT_META[ev.kind].emoji} {chipLabel(ev, names)}
              </button>
            ))}
            {row.milestones.map((m) => (
              <span
                key={m}
                className="rounded-[10px] bg-brand/10 px-2.5 py-1.5 text-[12.5px] font-bold text-brand"
              >
                🎉 {short(m)} 달성
              </span>
            ))}
            {row.reached && (
              <span className="rounded-[10px] bg-brand px-2.5 py-1.5 text-[12.5px] font-bold text-white">
                🎉 {short(target)} 도착
              </span>
            )}
          </div>
        )}
        {row.isTarget && row.value < target && extraNeeded > 0 && (
          <p className="mt-1.5 text-[12.5px] text-sub">
            매달 <b className="text-brand">{short(extraNeeded)} 원</b> 더 모으면 딱 맞아요
          </p>
        )}
      </div>
    </div>
  )
}

function Rail({ dot, line }: { dot: string; line: 'solid' | 'dash' | null }) {
  return (
    <div className="flex w-5 shrink-0 flex-col items-center">
      <span className={`mt-1 shrink-0 rounded-full ${dot}`} />
      {line && (
        <span
          className={`my-1 w-0.5 flex-1 ${line === 'solid' ? 'bg-brand/20' : 'border-l-2 border-dashed border-brand/20'}`}
        />
      )}
    </div>
  )
}

function chipLabel(ev: RoadmapEvent, names: [string, string]): string {
  switch (ev.kind) {
    case 'house':
      return ev.price ? `내 집 마련 ${compactKRW(ev.price)}` : '내 집 마련'
    case 'child':
      return `${ev.title || '아이'} 태어남`
    case 'leave':
      return `${names[(ev.member ?? 2) - 1]} 육아휴직 ${ev.months ?? 12}개월`
    case 'car':
      return ev.once ? `차 바꾸기 ${compactKRW(ev.once)}` : '차 바꾸기'
    case 'job':
      return '이직·창업'
    case 'parents':
      return '부모님 지원'
    case 'custom':
      return ev.title || '직접 입력'
  }
}

/** 바텀시트 껍데기 — 바깥을 누르면 닫힌다 */
function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 lg:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="max-h-[88vh] w-full max-w-app overflow-y-auto rounded-t-card bg-white px-5 pb-8 pt-2.5 lg:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="flex items-center justify-between">
          <p className="text-[17px] font-bold text-ink">{title}</p>
          <button onClick={onClose} aria-label="닫기" className="text-cap">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ───────── 계획 바텀시트 ───────── */

const KINDS: RoadmapEventKind[] = ['house', 'child', 'leave', 'car', 'job', 'parents', 'custom']

function newEvent(kind: RoadmapEventKind, nowYm: string): RoadmapEvent {
  const ym = shiftYm(nowYm, 12)
  switch (kind) {
    case 'house':
      return { id: genId(), kind, ym, price: 0, loan: 0 }
    case 'child':
      return { id: genId(), kind, ym, monthly: RULES.childCostDefault }
    case 'leave':
      return { id: genId(), kind, ym, member: 2, months: 12 }
    default:
      return { id: genId(), kind, ym }
  }
}

function EventSheet({
  initial,
  isNew,
  names,
  childNames,
  onClose,
  onSave,
  onDelete,
}: {
  initial: RoadmapEvent
  isNew: boolean
  names: [string, string]
  childNames: string[]
  onClose: () => void
  onSave: (ev: RoadmapEvent) => void
  onDelete: (id: string) => void
}) {
  const [ev, setEv] = useState(initial)
  const set = (patch: Partial<RoadmapEvent>) => setEv((e) => ({ ...e, ...patch }))
  const pickKind = (kind: RoadmapEventKind) =>
    setEv({ ...newEvent(kind, currentYm()), id: ev.id, ym: ev.ym })
  const jobUp = (ev.monthly ?? 0) <= 0 // 이직·창업: 수입이 느는 쪽인지

  return (
    <Sheet title={isNew ? '계획 추가' : '계획 고치기'} onClose={onClose}>
      {isNew && (
        <>
          <Label>어떤 계획인가요</Label>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k}
                onClick={() => pickKind(k)}
                className={`rounded-btn px-3 py-2 text-[13px] font-bold ${ev.kind === k ? 'bg-brand/10 text-brand' : 'bg-bg text-sub'}`}
              >
                {EVENT_META[k].emoji} {EVENT_META[k].label}
              </button>
            ))}
          </div>
        </>
      )}

      {(ev.kind === 'custom' || ev.kind === 'child') && (
        <>
          <Label>{ev.kind === 'child' ? '아이 이름' : '이름'}</Label>
          {ev.kind === 'child' && childNames.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {childNames.map((c) => (
                <button
                  key={c}
                  onClick={() => set({ title: c })}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-bold ${ev.title === c ? 'bg-amber-100 text-amber-700' : 'bg-bg text-sub'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <input
            type="text"
            value={ev.title ?? ''}
            onChange={(e) => set({ title: e.target.value })}
            placeholder={ev.kind === 'child' ? '첫째' : '세계여행'}
            className={TEXT_INPUT}
          />
        </>
      )}

      {ev.kind === 'leave' && (
        <>
          <Label>누가 쉬나요</Label>
          <Chips
            options={[1, 2].map((m) => ({ key: m as 1 | 2, label: names[m - 1] }))}
            value={ev.member ?? 2}
            onPick={(m) => set({ member: m })}
          />
        </>
      )}

      <Label>{ev.kind === 'child' ? '태어난 달 (예정)' : WHEN_LABEL[ev.kind]}</Label>
      <input
        type="month"
        value={ev.ym}
        onChange={(e) => e.target.value && set({ ym: e.target.value })}
        className={TEXT_INPUT}
      />

      {ev.kind === 'house' && (
        <div className="flex gap-2">
          <div className="flex-1">
            <Label>집값</Label>
            <AmountInput value={ev.price ?? 0} onChange={(n) => set({ price: n })} />
          </div>
          <div className="flex-1">
            <Label>그중 대출</Label>
            <AmountInput value={ev.loan ?? 0} onChange={(n) => set({ loan: n })} />
          </div>
        </div>
      )}

      {ev.kind === 'child' && (
        <>
          <Label>한 달 양육비</Label>
          <AmountInput value={ev.monthly ?? 0} onChange={(n) => set({ monthly: n })} />
          <p className="mt-1 text-[12px] text-cap">
            기본값은 가구 평균 150만 원이에요. 부모급여·아동수당은 알아서 빼요.
          </p>
        </>
      )}

      {ev.kind === 'leave' && (
        <>
          <Label>얼마나</Label>
          <Chips
            options={[3, 6, 12, 18, 24].map((m) => ({ key: m, label: `${m}개월` }))}
            value={ev.months ?? 12}
            onPick={(m) => set({ months: m })}
          />
          <p className="mt-1.5 text-[12px] text-cap">
            월소득에서 육아휴직 급여를 뺀 만큼 덜 모인다고 봐요.
          </p>
        </>
      )}

      {ev.kind === 'car' && (
        <>
          <Label>얼마</Label>
          <AmountInput value={ev.once ?? 0} onChange={(n) => set({ once: n })} />
        </>
      )}

      {ev.kind === 'job' && (
        <>
          <Label>한 달 수입이</Label>
          <Chips
            options={[
              { key: 'up', label: '늘어요' },
              { key: 'down', label: '줄어요' },
            ]}
            value={jobUp ? 'up' : 'down'}
            onPick={(d) => set({ monthly: (d === 'up' ? -1 : 1) * Math.abs(ev.monthly ?? 0) })}
          />
          <div className="mt-2">
            <AmountInput
              value={Math.abs(ev.monthly ?? 0)}
              onChange={(n) => set({ monthly: jobUp ? -n : n })}
            />
          </div>
        </>
      )}

      {(ev.kind === 'parents' || ev.kind === 'custom') && (
        <>
          <Label>한 번에 드는 돈</Label>
          <AmountInput value={ev.once ?? 0} onChange={(n) => set({ once: n || undefined })} />
          <Label>매달 드는 돈</Label>
          <AmountInput value={ev.monthly ?? 0} onChange={(n) => set({ monthly: n || undefined })} />
          {(ev.monthly ?? 0) > 0 && (
            <>
              <Label>몇 달 동안</Label>
              <AmountInput
                value={ev.months ?? 0}
                onChange={(n) => set({ months: n || undefined })}
                suffix="개월"
                placeholder="비우면 계속"
              />
            </>
          )}
        </>
      )}

      <button
        onClick={() => onSave(ev)}
        className="mt-5 w-full rounded-btn bg-brand py-3.5 text-[15px] font-bold text-white active:bg-brand-dark"
      >
        {isNew ? '추가하기' : '저장하기'}
      </button>
      {!isNew && (
        <button
          onClick={() => onDelete(ev.id)}
          className="mt-2 w-full py-2 text-[13px] font-bold text-danger"
        >
          이 계획 지우기
        </button>
      )}
    </Sheet>
  )
}

const WHEN_LABEL: Record<RoadmapEventKind, string> = {
  house: '언제 사나요',
  child: '태어난 달',
  leave: '언제부터',
  car: '언제 사나요',
  job: '언제부터',
  parents: '언제부터',
  custom: '언제',
}

const TEXT_INPUT =
  'w-full rounded-btn border border-line bg-white px-3.5 py-3 text-[15px] font-semibold text-ink outline-none focus:border-brand placeholder:font-normal placeholder:text-cap'

/* ───────── 작은 부품 ───────── */

function Box({ children }: { children: ReactNode }) {
  return <div className="rounded-card bg-card p-5 shadow-card">{children}</div>
}

function Chips<T extends string | number>({
  options,
  value,
  onPick,
}: {
  options: { key: T; label: string }[]
  value: T
  onPick: (key: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.key)}
          onClick={() => onPick(o.key)}
          className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors ${
            o.key === value ? 'bg-ink text-white' : 'bg-bg text-sub active:bg-line'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 mt-4 text-[12.5px] font-medium text-cap">{children}</p>
}

/** "30억", "1억 2,000만" — 원 없이 */
function short(n: number): string {
  return abbreviateKRW(n).replace(/원$/, '')
}

function ymText(ym: string): string {
  const [y, m] = ym.split('-')
  return `${y}년 ${Number(m)}월`
}

/** 14 → "1년 2개월" */
function spanText(months: number): string {
  const y = Math.floor(months / 12)
  const m = months % 12
  if (!y) return `${m}개월`
  return m ? `${y}년 ${m}개월` : `${y}년`
}
