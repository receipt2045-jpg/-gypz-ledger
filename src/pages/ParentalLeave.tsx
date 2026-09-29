import { useMemo, useState } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import AmountInput from '../components/AmountInput'
import Card from '../components/Card'
import {
  LEAVE_SAVE_KEY,
  MONTH_OPTIONS,
  RULES,
  readLeaveInput,
  simulate,
  type DaycareFrom,
  type LeaveInput,
  type LeaveMonth,
  type LeaveRun,
  type Order,
  type Who,
} from '../lib/parentalLeave'

const ONETEAM_URL = 'https://oneteamm.netlify.app'

/** 원 → "160" (만원 단위, 반올림). 부호는 붙이지 않는다 */
const man = (n: number) => Math.round(Math.abs(n) / 10_000).toLocaleString('ko-KR')

/**
 * 육아휴직 하면 우리 집은 어떻게 될까 — 로그인 없이 열리는 공개 계산기.
 * 영상·SNS에서 바로 들어오는 자리라 가입을 요구하지 않는다.
 * 위에서부터: 한 줄 결론 + 구간 칸 → 달마다 막대 → 한 달 계산 표 → 우리집 숫자 → 고치기 → 원팀프로젝트.
 */
export default function ParentalLeave() {
  const [v, setV] = useState<LeaveInput>(readLeaveInput)
  const [openAdjust, setOpenAdjust] = useState(false)

  const set = (patch: Partial<LeaveInput>) => {
    const next = { ...v, ...patch }
    setV(next)
    try {
      localStorage.setItem(LEAVE_SAVE_KEY, JSON.stringify(next))
    } catch {
      /* 시크릿 모드에서는 저장하지 않는다 */
    }
  }

  const r = useMemo(() => simulate(v), [v])
  const both = v.who === 'both'

  return (
    <div className="flex min-h-screen justify-center bg-bg">
      <div className="w-full max-w-app px-5 pb-16 pt-6">
        {/* ── 한 줄 결론 */}
        <header className="px-1">
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-[26px]"
            aria-hidden
          >
            🍼
          </div>
          <h1 className="text-[23px] font-bold leading-[1.6] text-ink">
            {r.monthlyNow >= 0 ? (
              <>
                매달 <Blank>{man(r.monthlyNow)}</Blank>만원 모으던 우리집,
              </>
            ) : (
              <>
                지금도 매달 <Blank>{man(r.monthlyNow)}</Blank>만원 적자인 우리집,
              </>
            )}
            <br />
            육아휴직하면 한 달에
          </h1>
        </header>

        <RunBoxes runs={r.runs} showWho={both} />
        <MonthBars months={r.months} now={r.monthlyNow} />
        <CalcTable runs={r.runs} />

        {/* ── 우리집 숫자 */}
        <Card className="mt-4">
          <p className="text-[15px] font-bold text-ink">우리집 숫자</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field label="아내 월 실수령">
              <AmountInput value={v.payWife} onChange={(n) => set({ payWife: n })} />
            </Field>
            <Field label="남편 월 실수령">
              <AmountInput value={v.payHusband} onChange={(n) => set({ payHusband: n })} />
            </Field>
            <Field label="월 고정비">
              <AmountInput value={v.fixed} onChange={(n) => set({ fixed: n })} />
            </Field>
            <Field label="월 변동비">
              <AmountInput value={v.variable} onChange={(n) => set({ variable: n })} />
            </Field>
          </div>

          <p className="mb-1.5 mt-4 text-[13.5px] font-medium text-sub">누가 쉬어요?</p>
          <Segment<Who>
            value={v.who}
            onChange={(who) => set({ who })}
            options={[
              ['wife', '아내'],
              ['husband', '남편'],
              ['both', '둘 다'],
            ]}
          />
        </Card>

        {/* ── 고치기 */}
        <Card className="mt-4">
          <button
            onClick={() => setOpenAdjust((o) => !o)}
            className="flex w-full items-center justify-between"
            aria-expanded={openAdjust}
          >
            <span className="text-[15px] font-bold text-ink">우리집에 맞게 고치기</span>
            <ChevronDown
              size={18}
              className={`text-cap transition-transform ${openAdjust ? 'rotate-180' : ''}`}
            />
          </button>

          {openAdjust && (
            <div className="mt-4 space-y-4">
              {v.who !== 'husband' && (
                <Field label="아내 휴직 기간">
                  <MonthSegment value={v.monthsWife} onChange={(monthsWife) => set({ monthsWife })} />
                </Field>
              )}
              {v.who !== 'wife' && (
                <Field label="남편 휴직 기간">
                  <MonthSegment
                    value={v.monthsHusband}
                    onChange={(monthsHusband) => set({ monthsHusband })}
                  />
                </Field>
              )}
              {both && (
                <Field label="어떻게 쉬어요?">
                  <Segment<Order>
                    value={v.order}
                    onChange={(order) => set({ order })}
                    options={[
                      ['seq', '번갈아 (아내 먼저)'],
                      ['sim', '같이'],
                    ]}
                  />
                  <Note>
                    둘 다 쉬면 각자 첫 6개월은 급여 상한이 250만원에서 450만원까지 올라가요.
                  </Note>
                </Field>
              )}

              <Field label="늘어나는 양육비 (월)">
                <AmountInput value={v.childCost} onChange={(childCost) => set({ childCost })} />
                <Note>영유아 키우는 집 평균 150만원이에요. 우리집 예상으로 바꿔도 돼요.</Note>
              </Field>

              <Field label="어린이집은 언제부터?">
                <Segment<DaycareFrom>
                  value={v.daycareFrom}
                  onChange={(daycareFrom) => set({ daycareFrom })}
                  options={[
                    [0, '안 보내요'],
                    [7, '7개월부터'],
                    [13, '돌 지나서'],
                  ]}
                />
                <Note>어린이집에 다니는 달엔 부모급여가 보육료만큼 줄어요.</Note>
              </Field>
            </div>
          )}
        </Card>

        {/* ── 원팀프로젝트 */}
        <div className="mt-5 rounded-card border-[1.5px] border-brand bg-white p-5">
          <p className="text-[12px] font-bold text-brand">결영이네 원팀프로젝트</p>
          <p className="mt-1 text-[18px] font-bold leading-snug text-ink">
            적자 나는 달, 없도록 미리 공부해요.
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-sub">
            <b className="font-bold text-ink">부부가 함께</b> 재테크 시작하면 돈 모으는 속도가
            빨라져요.
          </p>
          <a
            href={ONETEAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-btn bg-brand py-3.5 text-[15px] font-bold text-white"
          >
            원팀프로젝트 보러가기
            <ArrowRight size={17} />
          </a>
        </div>
        <p className="mt-3 text-center text-[12.5px] text-cap">
          가계부부터 써보고 싶다면{' '}
          <a href="#/" className="font-semibold text-brand">
            모아불리 시작하기
          </a>
        </p>

        {/* ── 출처 */}
        <div className="mt-8 px-1 text-[12px] leading-relaxed text-cap">
          <p className="font-semibold text-sub">이 숫자는 어디서 왔나요</p>
          <ul className="mt-1.5 space-y-1">
            <li>
              · 육아휴직급여 — 한 명만 쉬면 1~3개월 최대 250만원, 4~6개월 최대 200만원, 7개월부터
              월급의 80% 최대 160만원. 부부가 둘 다 쉬면 각자 첫 6개월 최대 250·250·300·350·400·450만원.
              최소 70만원. 고용노동부 고용보험
            </li>
            <li>
              · 부모급여 — 만 0세 월 100만원, 만 1세 월 50만원. 어린이집에 다니면 보육료를 빼고 0세는
              41.6만원, 1세는 0원. 아동수당 월 10만원. 보건복지부
            </li>
            <li>
              · 양육비 — 육아정책연구소 KICCE 소비실태조사 2025, 2024년 가구당 양육비용 월 149.8만원.
              집 안 모든 자녀에게 든 돈의 합이에요
            </li>
            <li>· 기준일 {RULES.updated}</li>
          </ul>
          <p className="mt-3">
            아이가 태어나자마자 휴직을 시작하고, 고정비·변동비는 지금 그대로 쓴다고 봤어요. 급여는
            세전 월급(통상임금) 기준이라 실수령으로 넣으면 실제로는 같거나 조금 더 받아요. 방향을 보는
            용도로만 쓰시고, 정확한 금액은 고용보험에서 확인하세요.
          </p>
        </div>
      </div>
    </div>
  )
}

function Blank({ children }: { children: React.ReactNode }) {
  return <span className="tnum mx-0.5 inline-block rounded-lg bg-white px-2">{children}</span>
}

/** 같은 숫자가 이어지는 달을 한 칸씩 — 모여요 / 적자예요 */
function RunBoxes({ runs, showWho }: { runs: LeaveRun[]; showWho: boolean }) {
  if (runs.length === 0) return null
  return (
    <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {runs.map((run) => {
        const deficit = run.month.saved < 0
        const tone = deficit ? 'text-danger' : 'text-brand'
        return (
          <div
            key={run.from}
            className={`min-w-[78px] flex-1 rounded-[12px] px-1 py-2.5 text-center ${
              deficit ? 'bg-danger/10' : 'bg-brand/10'
            }`}
          >
            <p className={`text-[11.5px] font-medium ${tone}`}>{periodLabel(run)}</p>
            <p className={`tnum mt-0.5 text-[18px] font-bold leading-tight ${tone}`}>
              {deficit ? '−' : ''}
              {man(run.month.saved)}만
            </p>
            <p className={`mt-0.5 text-[11.5px] ${tone}`}>{deficit ? '적자예요' : '모여요'}</p>
            {showWho && <p className={`mt-1 text-[11px] ${tone}`}>{whoLabel(run.month)}</p>}
          </div>
        )
      })}
    </div>
  )
}

const periodLabel = (run: LeaveRun) =>
  run.from === run.to ? `${run.from}개월` : `${run.from}~${run.to}개월`

function whoLabel(m: LeaveMonth): string {
  if (m.wifeOnLeave && m.husbandOnLeave) return '둘 다 휴직'
  return m.wifeOnLeave ? '아내 휴직' : '남편 휴직'
}

/** 달마다 막대 — 회색은 지금 모으는 돈, 파랑은 휴직 중 모이는 돈, 빨강은 적자 */
function MonthBars({ months, now }: { months: LeaveMonth[]; now: number }) {
  if (months.length === 0) return null
  const W = 340
  const values = months.map((m) => m.saved)
  const top = Math.max(now, ...values, 1)
  const bottom = Math.min(0, now, ...values)
  const H = 130
  const scale = H / (top - bottom)
  const zeroY = 10 + top * scale
  const slot = W / months.length
  const bw = Math.min(20, slot * 0.65)
  const nowH = Math.max(now, 0) * scale

  return (
    <Card className="mt-4">
      <svg viewBox={`0 0 ${W} 170`} className="block w-full" role="img" aria-label="달마다 모이는 돈">
        {months.map((m, i) => {
          const x = i * slot + (slot - bw) / 2
          const h = Math.abs(m.saved) * scale
          const tick = i === 0 || (i + 1) % 6 === 0
          return (
            <g key={m.t}>
              <rect x={x} y={zeroY - nowH} width={bw} height={nowH} rx={2.5} className="fill-[#D1D6DB]" />
              {m.saved >= 0 ? (
                <rect x={x} y={zeroY - h} width={bw} height={h} rx={2.5} className="fill-brand" />
              ) : (
                <rect x={x} y={zeroY} width={bw} height={h} rx={2.5} className="fill-danger" />
              )}
              {tick && (
                <text
                  x={Math.min(x + bw / 2, W - 20)}
                  y={166}
                  textAnchor="middle"
                  className="fill-cap text-[11px]"
                >
                  {m.t}개월
                </text>
              )}
            </g>
          )
        })}
        <line x1={0} x2={W} y1={zeroY} y2={zeroY} className="stroke-line" strokeWidth={1} />
      </svg>
      <div className="mt-1.5 flex justify-center gap-4 text-[12px] text-sub">
        <Legend className="bg-[#D1D6DB]" label="지금" />
        <Legend className="bg-brand" label="육아휴직하면" />
      </div>
    </Card>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  )
}

/** 한 달에 들어오고 나가는 돈 — 평균 없이 칸마다 실제 금액 */
function CalcTable({ runs }: { runs: LeaveRun[] }) {
  if (runs.length === 0) return null
  const cell = 'tnum px-1.5 py-1 text-right'
  const earner = (amount: number, onLeave: boolean) => (
    <span className={onLeave ? 'text-brand' : ''}>
      {man(amount)}
      {onLeave && <span className="block text-[10.5px] leading-tight">휴직급여</span>}
    </span>
  )
  return (
    <Card className="mt-4">
      <p className="text-[15px] font-bold text-ink">한 달 계산</p>
      <div className="-mx-1 mt-2 overflow-x-auto">
        <table className="w-full min-w-max text-[12.5px] text-sub">
          <thead>
            <tr className="text-[11.5px] text-cap">
              <th className="py-1 pl-1 text-left font-medium">만원</th>
              {runs.map((run) => (
                <th key={run.from} className="px-1.5 py-1 text-right font-medium">
                  {periodLabel(run)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <GroupRow label="들어오는 돈" span={runs.length} />
            <tr>
              <td className="py-1 pl-1">아내</td>
              {runs.map((run) => (
                <td key={run.from} className={cell}>
                  {earner(run.month.wife, run.month.wifeOnLeave)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-1 pl-1">남편</td>
              {runs.map((run) => (
                <td key={run.from} className={cell}>
                  {earner(run.month.husband, run.month.husbandOnLeave)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-1 pl-1">부모급여·아동수당</td>
              {runs.map((run) => (
                <td key={run.from} className={cell}>
                  {man(run.month.gov)}
                </td>
              ))}
            </tr>
            <GroupRow label="나가는 돈" span={runs.length} />
            <tr>
              <td className="py-1 pl-1">고정비·변동비</td>
              {runs.map((run) => (
                <td key={run.from} className={cell}>
                  {man(run.month.spend)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-1 pl-1">늘어나는 양육비</td>
              {runs.map((run) => (
                <td key={run.from} className={cell}>
                  {man(run.month.childCost)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-line">
              <td className="py-1.5 pl-1 font-bold text-ink">모이는 돈</td>
              {runs.map((run) => {
                const deficit = run.month.saved < 0
                return (
                  <td
                    key={run.from}
                    className={`${cell} py-1.5 font-bold ${deficit ? 'text-danger' : 'text-brand'}`}
                  >
                    {deficit ? '−' : ''}
                    {man(run.month.saved)}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <Note>
        육아휴직급여는 한 명만 쉬면 첫 3개월 최대 250만, 4~6개월 200만, 이후 월급의 80% 최대 160만원이에요.
        부모급여는 만 0세 100만원, 돌 지나면 50만원이고 아동수당 10만원을 더했어요.
      </Note>
    </Card>
  )
}

function GroupRow({ label, span }: { label: string; span: number }) {
  return (
    <tr>
      <td colSpan={span + 1} className="pb-0.5 pl-1 pt-2.5 text-[11.5px] text-cap">
        {label}
      </td>
    </tr>
  )
}

function Segment<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: [T, string][]
}) {
  return (
    <div className="flex gap-2">
      {options.map(([key, label]) => (
        <button
          key={String(key)}
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={`flex-1 rounded-btn border py-2.5 text-[13.5px] font-semibold ${
            value === key ? 'border-brand bg-brand/5 text-brand' : 'border-line bg-white text-sub'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function MonthSegment({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <Segment<number>
      value={value}
      onChange={onChange}
      options={MONTH_OPTIONS.map((m) => [m, `${m}개월`])}
    />
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[13.5px] font-medium text-sub">{label}</p>
      {children}
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[12px] leading-relaxed text-cap">{children}</p>
}
