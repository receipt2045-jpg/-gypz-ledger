import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import AmountInput from '../components/AmountInput'
import { useLedgerStore } from '../lib/store'
import { genId, netWorthOf, resolveSnapshot } from '../lib/carryover'
import { abbreviateKRW, currentYm, shiftYm } from '../lib/format'
import {
  EVENT_META,
  GROWTH_PRESETS,
  MAX_MONTHS,
  RETURN_PRESETS,
  computeRoadmap,
  eventSummary,
  ledgerAverages,
  monthsBetween,
  roadmapInput,
  type RoadmapPoint,
  type RoadmapResult,
} from '../lib/roadmap'
import { RULES } from '../lib/parentalLeave'
import type { Roadmap as RoadmapData, RoadmapEvent, RoadmapEventKind } from '../types'

/**
 * 자산 로드맵 (2026-10-05) — 설정·홈 목표 카드에서 들어온다. 탭에는 두지 않는다.
 *
 * 9/30에 뺀 옛 로드맵 탭은 카드가 많고 같은 말을 반복했다. 이번엔 맨 위에 답 하나
 * ('언제 닿는지 · 매달 얼마 더'), 그 아래 그래프 하나, 계획 목록. 목표·가정처럼
 * 한 번 정하면 잘 안 고치는 값은 맨 아래로 내렸다. 계획은 바텀시트에서 넣고 고친다.
 */
export default function Roadmap() {
  const navigate = useNavigate()
  const { profile, ledgers, snapshots, updateProfile } = useLedgerStore()
  const roadmap: RoadmapData = profile.roadmap ?? { events: [] }
  const setRoadmap = (patch: Partial<RoadmapData>) =>
    updateProfile({ roadmap: { ...roadmap, ...patch } })

  const nowYm = currentYm()
  const netWorth = netWorthOf(resolveSnapshot(snapshots, nowYm))
  const auto = useMemo(() => ledgerAverages(ledgers), [ledgers])
  const input = roadmapInput(profile, ledgers, netWorth, nowYm)
  const result = useMemo(() => computeRoadmap(input), [JSON.stringify(input)]) // eslint-disable-line react-hooks/exhaustive-deps
  const targetYear = Number(input.targetYm.slice(0, 4))
  const names: [string, string] = [profile.member1Name, profile.member2Name]

  // 실제 기록 — 최근 2년 스냅샷
  const actual: RoadmapPoint[] = snapshots
    .filter((s) => s.ym <= nowYm && s.items.length > 0)
    .slice(-24)
    .map((s) => ({ ym: s.ym, value: netWorthOf(s) }))

  const [sheet, setSheet] = useState<RoadmapEvent | null>(null)
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
    <div className="min-h-screen bg-bg pb-16">
      <div className="mx-auto w-full max-w-app">
        <div className="flex items-center gap-1 px-3 pt-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-sub active:bg-line"
            aria-label="뒤로"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-[18px] font-bold text-ink">우리집 자산 로드맵</h1>
        </div>

        <div className="space-y-3 px-5 pt-3">
          <Answer result={result} input={input} targetYear={targetYear} hasSaving={input.monthlySaving > 0} />

          {input.target > 0 && (
            <Section title="예상 흐름">
              <Chart
                result={result}
                actual={actual}
                events={roadmap.events}
                target={input.target}
                startYm={nowYm}
                targetYm={input.targetYm}
              />
              {result.milestones.length > 0 && (
                <div className="mt-3 flex gap-1.5">
                  {result.milestones.map((m) => (
                    <div key={m.amount} className="flex-1 rounded-btn bg-bg px-2 py-2 text-center">
                      <p className="text-[12px] text-cap">{short(m.amount)}</p>
                      <p className="tnum mt-0.5 text-[13px] font-bold text-ink">
                        {m.ym ? m.ym.replace('-', '.') : '40년 뒤'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          <Section title="우리집 계획">
            {roadmap.events.length === 0 && (
              <p className="pb-1 text-[13px] leading-relaxed text-sub">
                집, 아이, 차처럼 큰돈이 드는 일을 넣으면 그래프에 같이 그려져요.
              </p>
            )}
            {roadmap.events.map((ev) => (
              <button
                key={ev.id}
                onClick={() => setSheet(ev)}
                className="flex w-full items-center gap-3 border-t border-line py-2.5 text-left first-of-type:border-t-0"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-[18px]">
                  {EVENT_META[ev.kind].emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold text-ink">{eventTitle(ev)}</span>
                  <span className="tnum block truncate text-[12px] text-cap">{eventSummary(ev, names)}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-cap" />
              </button>
            ))}
            <button
              onClick={() => setSheet(newEvent('house', nowYm))}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-btn border-[1.5px] border-dashed border-line py-3 text-[13px] font-bold text-brand active:bg-bg"
            >
              <Plus size={15} /> 계획 추가
            </button>
          </Section>

          <Section title="우리집 목표와 지금">
            <p className="-mt-1 mb-1 text-[12.5px] leading-relaxed text-cap">
              가계부에 적은 걸로 미리 채워 뒀어요. 실제와 다르면 고쳐 주세요.
            </p>
            <Row label="모으고 싶은 돈" hint="빚을 빼고 남는 재산 기준">
              <AmountInput
                value={profile.targetNetWorth}
                onChange={(n) => updateProfile({ targetNetWorth: n })}
                className="w-[170px]"
              />
            </Row>
            <Row label="언제까지 모을까요">
              <select
                value={targetYear}
                onChange={(e) => setRoadmap({ targetYear: Number(e.target.value) })}
                className="rounded-btn border border-line bg-white px-3 py-2.5 text-[15px] font-semibold text-ink outline-none focus:border-brand"
              >
                {Array.from({ length: 31 }, (_, i) => Number(nowYm.slice(0, 4)) + i).map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </Row>
            <Row label="지금 우리집 재산" hint="가진 돈에서 빚을 뺀 금액">
              <button
                onClick={() => navigate('/asset-setup')}
                className="tnum text-[15px] font-bold text-ink"
              >
                {abbreviateKRW(netWorth)}
              </button>
            </Row>
            <AutoRow
              label="한 달에 남는 돈"
              autoValue={auto.saving}
              autoHint={auto.months ? `최근 ${auto.months}개월 수입 − 지출` : '수입 − 지출'}
              value={roadmap.monthlySaving}
              onChange={(n) => setRoadmap({ monthlySaving: n })}
            />
            {/* 월소득은 육아휴직 계획에만 쓰여서, 그 계획이 있을 때만 묻는다 */}
            {roadmap.events.some((e) => e.kind === 'leave') && (
              <>
                <AutoRow
                  label={`${names[0]} 한 달 수입`}
                  autoValue={auto.income1}
                  autoHint="육아휴직 때 줄어드는 돈 계산용"
                  value={roadmap.income1}
                  onChange={(n) => setRoadmap({ income1: n })}
                />
                <AutoRow
                  label={`${names[1]} 한 달 수입`}
                  autoValue={auto.income2}
                  autoHint="육아휴직 때 줄어드는 돈 계산용"
                  value={roadmap.income2}
                  onChange={(n) => setRoadmap({ income2: n })}
                />
              </>
            )}
          </Section>

          <Section title="계산 기준">
            <p className="mb-1.5 text-[12px] text-cap">모은 돈이 1년에 불어나는 정도</p>
            <Chips
              options={RETURN_PRESETS.map((p) => ({ key: p.rate, label: `${p.label} ${Math.round(p.rate * 100)}%` }))}
              value={input.returnRate}
              onPick={(rate) => setRoadmap({ returnRate: rate })}
            />
            <p className="mb-1.5 mt-3 text-[12px] text-cap">월급이 1년에 오르는 정도 · 남는 돈도 같이 늘어요</p>
            <Chips
              options={GROWTH_PRESETS.map((g) => ({ key: g, label: `${Math.round(g * 100)}%` }))}
              value={input.incomeGrowth}
              onPick={(g) => setRoadmap({ incomeGrowth: g })}
            />
            <button
              onClick={() => setRoadmap({ realTerms: !input.realTerms })}
              className="mt-3 flex w-full items-center justify-between border-t border-line pt-3"
              role="switch"
              aria-checked={input.realTerms}
            >
              <span className="text-left">
                <span className="block text-[14px] text-sub">물가 빼고 보기</span>
                <span className="block text-[12px] text-cap">물가가 오르는 만큼 빼고, 지금 돈 가치로 보여줘요</span>
              </span>
              <span
                className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${input.realTerms ? 'bg-brand' : 'bg-line'}`}
              >
                <span
                  className={`absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all ${input.realTerms ? 'right-[3px]' : 'left-[3px]'}`}
                />
              </span>
            </button>
          </Section>

          <p className="px-1 pt-1 text-center text-[11.5px] leading-relaxed text-cap">
            방향을 잡기 위한 예상이에요. 집을 사면 취득세·중개비 3%와 대출 이자(연 4%)를, 아이는
            양육비에서 부모급여·아동수당을 뺀 만큼을 반영해요.
          </p>
        </div>
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
    </div>
  )
}

/* ───────── 맨 위 답 ───────── */

function Answer({
  result,
  input,
  targetYear,
  hasSaving,
}: {
  result: RoadmapResult
  input: ReturnType<typeof roadmapInput>
  targetYear: number
  hasSaving: boolean
}) {
  if (input.target <= 0) {
    return (
      <Box>
        <p className="text-[17px] font-bold text-ink">모으고 싶은 돈부터 정해 주세요</p>
        <p className="mt-1 text-[13px] text-sub">아래에 금액을 넣으면 언제쯤 모이는지 계산해 드려요.</p>
      </Box>
    )
  }
  if (input.netWorth >= input.target) {
    return (
      <Box>
        <p className="text-[20px] font-extrabold text-ink">
          <span className="text-brand">{short(input.target)}</span>, 이미 도착했어요 🎉
        </p>
        <p className="mt-1 text-[13px] text-sub">다음 목표를 올려 보세요.</p>
      </Box>
    )
  }
  const diff = result.reachYm ? monthsBetween(input.targetYm, result.reachYm) : null
  return (
    <Box>
      <p className="text-[12px] text-cap">지금 속도라면</p>
      {result.reachYm ? (
        <p className="mt-1 text-[21px] font-extrabold leading-snug text-ink">
          {ymText(result.reachYm)}, <span className="text-brand">{short(input.target)}</span> 도착
        </p>
      ) : (
        <p className="mt-1 text-[19px] font-extrabold leading-snug text-ink">40년 안에는 닿기 어려워요</p>
      )}
      {diff !== null && diff !== 0 && (
        <p className="mt-1 text-[13px] text-sub">
          목표({targetYear}년 말)보다{' '}
          <b className={diff > 0 ? 'text-danger' : 'text-brand'}>{spanText(Math.abs(diff))}</b>{' '}
          {diff > 0 ? '늦어요' : '빨라요'}
        </p>
      )}
      {diff === 0 && <p className="mt-1 text-[13px] text-sub">목표({targetYear}년 말)에 딱 맞춰 가고 있어요</p>}
      {result.extraNeeded > 0 && (
        <div className="mt-3 rounded-btn bg-bg px-3.5 py-3 text-[13px] text-sub">
          {targetYear}년에 맞추려면 매달{' '}
          <b className="tnum text-brand">{abbreviateKRW(result.extraNeeded).replace(/원$/, '')} 원</b> 더 모으면 돼요
        </div>
      )}
      {!hasSaving && (
        <p className="mt-2 text-[12px] text-danger">
          한 달에 남는 돈이 0원으로 잡혀 있어요. 아래에서 적어 주세요.
        </p>
      )}
    </Box>
  )
}

/* ───────── 그래프 ───────── */

const W = 320
const H = 170
const PAD = { l: 30, r: 8, t: 18, b: 22 }

function Chart({
  result,
  actual,
  events,
  target,
  startYm,
  targetYm,
}: {
  result: RoadmapResult
  actual: RoadmapPoint[]
  events: RoadmapEvent[]
  target: number
  startYm: string
  targetYm: string
}) {
  const firstYm = actual.length ? actual[0].ym : startYm
  const lastYm = (() => {
    const far = result.reachYm && result.reachYm > targetYm ? result.reachYm : targetYm
    const end = shiftYm(far, 12)
    const cap = shiftYm(startYm, MAX_MONTHS)
    return end > cap ? cap : end
  })()
  const span = Math.max(1, monthsBetween(firstYm, lastYm))
  const inWindow = (p: RoadmapPoint) => p.ym <= lastYm
  const proj = result.points.filter(inWindow)
  const track = result.onTrack?.filter(inWindow) ?? null

  const all = [...actual, ...proj, ...(track ?? [])].map((p) => p.value)
  const yMax = Math.max(target, ...all) * 1.06
  const yMin = Math.min(0, ...all)
  const x = (ym: string) => PAD.l + (monthsBetween(firstYm, ym) / span) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b)
  const path = (pts: RoadmapPoint[]) =>
    pts
      .filter((_, i) => i % 3 === 0 || i === pts.length - 1)
      .map((p, i) => `${i ? 'L' : 'M'}${x(p.ym).toFixed(1)} ${y(p.value).toFixed(1)}`)
      .join(' ')

  const step = niceStep(target / 4)
  const ticks = Array.from({ length: 8 }, (_, i) => (i + 1) * step).filter((t) => t < target * 0.92)
  // 연도 눈금 — 처음·목표·끝. 서로 붙으면(40px 안) 목표 쪽만 남긴다
  const yearMarks = [
    { ym: firstYm, anchor: 'start' as const },
    { ym: targetYm, anchor: 'middle' as const },
    { ym: lastYm, anchor: 'end' as const },
  ].filter((m, i, arr) => i === 1 || arr.every((o, j) => j === i || j !== 1 || Math.abs(x(o.ym) - x(m.ym)) > 40))
  const valueAt = (ym: string) => proj.find((p) => p.ym === ym)?.value

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="순자산 예상 그래프">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#F2F4F6" />
            <text x={PAD.l - 4} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#8B95A1">
              {short(t)}
            </text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} stroke="#F04452" strokeDasharray="4 4" />
        <text x={PAD.l + 2} y={y(target) - 5} fontSize="10" fill="#F04452">
          목표 {short(target)}
        </text>
        {track && (
          <path d={path(track)} fill="none" stroke="#3182F6" strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="3 3" />
        )}
        <path d={path(proj)} fill="none" stroke="#3182F6" strokeWidth="2.5" strokeLinejoin="round" />
        {actual.length > 1 && <path d={path(actual)} fill="none" stroke="#191F28" strokeWidth="2.5" />}
        <circle cx={x(startYm)} cy={y(proj[0].value)} r="3.5" fill="#191F28" />
        {events
          .filter((ev) => ev.ym >= startYm && ev.ym <= lastYm)
          .map((ev, i, arr) => {
            const v = valueAt(ev.ym)
            if (v === undefined) return null
            // 같은 달 계획이 여럿이면 위로 쌓는다
            const cy = y(v) - 20 * arr.slice(0, i).filter((o) => o.ym === ev.ym).length
            return (
              <g key={ev.id}>
                <circle cx={x(ev.ym)} cy={cy} r="9" fill="#fff" stroke="#3182F6" />
                <text x={x(ev.ym)} y={cy + 3.5} textAnchor="middle" fontSize="10">
                  {EVENT_META[ev.kind].emoji}
                </text>
              </g>
            )
          })}
        {yearMarks.map((m) => (
          <text key={m.ym} x={x(m.ym)} y={H - 6} textAnchor={m.anchor} fontSize="9" fill="#8B95A1">
            {m.ym.slice(0, 4)}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-cap">
        {actual.length > 1 && (
          <span>
            <b className="text-ink">━</b> 실제 기록
          </span>
        )}
        <span>
          <b className="text-brand">━</b> 지금 속도
        </span>
        {track && (
          <span>
            <b className="text-brand/50">┅</b> 목표에 맞춘 속도
          </span>
        )}
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
  const pickKind = (kind: RoadmapEventKind) => setEv({ ...newEvent(kind, currentYm()), id: ev.id, ym: ev.ym })
  const jobUp = (ev.monthly ?? 0) <= 0 // 이직·창업: 수입이 느는 쪽인지

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="계획 추가"
    >
      <div
        className="max-h-[88vh] w-full max-w-app overflow-y-auto rounded-t-card bg-white px-5 pb-8 pt-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="flex items-center justify-between">
          <p className="text-[17px] font-bold text-ink">{isNew ? '계획 추가' : '계획 고치기'}</p>
          <button onClick={onClose} aria-label="닫기" className="text-cap">
            <X size={20} />
          </button>
        </div>

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
      </div>
    </div>
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

function eventTitle(ev: RoadmapEvent): string {
  if (ev.kind === 'child') return ev.title ? `${ev.title} 양육비` : '아이 양육비'
  if (ev.kind === 'custom') return ev.title || '직접 입력'
  if (ev.kind === 'parents') return '부모님 지원'
  if (ev.kind === 'car') return '차 사기'
  return EVENT_META[ev.kind].label
}

function Box({ children }: { children: ReactNode }) {
  return <div className="rounded-card bg-card p-5 shadow-card">{children}</div>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <h2 className="mb-2 text-[15px] font-bold text-ink">{title}</h2>
      {children}
    </Box>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line py-2.5 first-of-type:border-t-0">
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] text-sub">{label}</span>
        {hint && <span className="block text-[11.5px] text-cap">{hint}</span>}
      </span>
      {children}
    </div>
  )
}

/** 가계부로 자동 채운 값. 고치면 그 값을 쓰고, '자동으로'를 누르면 다시 가계부 값으로 */
function AutoRow({
  label,
  autoValue,
  autoHint,
  value,
  onChange,
}: {
  label: string
  autoValue: number
  autoHint: string
  value: number | undefined
  onChange: (n: number | undefined) => void
}) {
  const manual = value !== undefined
  return (
    <Row
      label={label}
      hint={manual ? undefined : autoHint}
    >
      <div className="flex flex-col items-end">
        <AmountInput value={value ?? autoValue} onChange={(n) => onChange(n)} className="w-[150px]" />
        {manual && (
          <button onClick={() => onChange(undefined)} className="mt-1 text-[11.5px] font-bold text-brand">
            가계부 값으로 되돌리기 ({short(autoValue)})
          </button>
        )}
      </div>
    </Row>
  )
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

/** 눈금 간격 — 1·2·5 × 10^k 중 가까운 값 */
function niceStep(n: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(n, 1))))
  const f = n / pow
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow
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
