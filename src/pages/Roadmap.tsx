import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import Card from '../components/Card'
import { useLedgerStore } from '../lib/store'
import { netWorthOf, resolveLedger, resolveSnapshot, summarize } from '../lib/carryover'
import { abbreviateKRW, currentYm } from '../lib/format'
import {
  PILLAR_INFO,
  STAGES,
  computePillars,
  currentStageIndex,
  diagnose,
  type Pillars,
} from '../lib/roadmap'

export default function Roadmap() {
  const navigate = useNavigate()
  const { ledgers, snapshots, profile } = useLedgerStore()

  const latestYm = ledgers.length ? ledgers[ledgers.length - 1].ym : currentYm()
  const ledger = resolveLedger(ledgers, latestYm)
  const s = summarize(ledger)
  const snapshot = resolveSnapshot(snapshots, latestYm)
  const netWorth = netWorthOf(snapshot)

  const pace = s.saving + s.investment
  const pillars = computePillars(ledger, s)
  const diag = diagnose(pillars)
  const stageIdx = currentStageIndex(s.income, pace, netWorth, profile.targetNetWorth)
  const hasIncome = s.income > 0

  return (
    <div className="animate-fade-up space-y-4 pb-24">
      {/* ── 헤더 ─────────────────────────────── */}
      <header className="px-1 pt-2">
        <div className="flex items-center gap-2">
          <span className="text-[22px]">🏠</span>
          <h1 className="text-[20px] font-extrabold tracking-tight text-ink">우리집까지 가는 길</h1>
        </div>
        <p className="mt-1.5 text-[13.5px] font-medium leading-relaxed text-sub">
          매일의 작은 선택이 우리집을 앞당겨요. 아래를 직접 움직여 보면서 우리 팀을 점검해요.
        </p>
      </header>

      {!hasIncome ? (
        <Card onClick={() => navigate('/monthly')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold text-ink">먼저 예산을 세워볼까요?</p>
              <p className="mt-1 text-[13px] text-sub">
                수입·지출을 넣으면 이 화면이 우리 숫자로 살아나요
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-cap" />
          </div>
        </Card>
      ) : (
        <>
          {/* ── ① 저축률 시뮬레이터 (조작) ──────── */}
          <SavingSimulator income={s.income} currentRate={s.savingInvestRate} currentPace={pace} />

          {/* ── ② 우리 팀 상태 (탭하면 설명) ────── */}
          <Card>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[15px] font-bold text-ink">우리 팀 상태</p>
              <span className="text-[12px] font-medium text-cap">눌러서 자세히 보기</span>
            </div>
            <p className="mb-3 text-[12.5px] text-cap">통장은 각자, 돈관리는 같이 🤍</p>
            <div className="space-y-2">
              {(Object.keys(PILLAR_INFO) as (keyof Pillars)[]).map((key) => (
                <PillarItem key={key} pillarKey={key} score={pillars[key]} />
              ))}
            </div>
            <div className="mt-4 flex gap-2 rounded-btn bg-bg p-3">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-brand" />
              <p className="text-[13.5px] font-medium leading-relaxed text-sub">{diag.headline}</p>
            </div>
          </Card>

          {/* ── ③ 이번 주 할 일 (체크) ──────────── */}
          <WeeklyTask weakest={diag.weakest} />
        </>
      )}

      {/* ── ④ 내집마련 여정 (부드럽게) ─────────── */}
      <div className="px-1 pt-1">
        <p className="mb-1 text-[13px] font-bold text-cap">내집마련 여정</p>
        <p className="text-[12px] text-cap">우리가 지나온 길과, 앞으로 만날 갈림길이에요</p>
      </div>
      <div className="space-y-2.5">
        {STAGES.map((stage, i) => {
          const state: 'done' | 'current' | 'future' =
            i < stageIdx ? 'done' : i === stageIdx ? 'current' : 'future'
          return (
            <div
              key={stage.key}
              className={`rounded-card border p-4 ${
                state === 'current' ? 'border-brand bg-brand/[0.04]' : 'border-line bg-card'
              } ${state === 'future' ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-[20px] leading-none">{stage.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[15px] font-bold text-ink">{stage.title}</p>
                    {state === 'current' && (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">
                        지금 여기
                      </span>
                    )}
                    {state === 'done' && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                        지남
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-sub">{stage.view}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── ⑤ 저단가 리포트 (준비 중) ──────────── */}
      {hasIncome && (
        <Card>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-bg px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            <span className="text-[11px] font-bold text-sub">준비 중</span>
          </div>
          <p className="text-[15px] font-bold text-ink">우리 부부 맞춤 리포트</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-sub">
            결영이네가 <b className="text-ink">우리 부부 숫자를 직접 보고</b> 만든 맞춤 리포트예요.
            지금 뭐가 제일 급한지, 다음 3개월에 뭘 해야 할지 콕 짚어드려요. 곧 만나요 🤍
          </p>
          <div className="mt-3 flex h-12 w-full items-center justify-center rounded-btn bg-line/60 text-[15px] font-bold text-cap">
            곧 열려요
          </div>
        </Card>
      )}
    </div>
  )
}

// ── ① 저축률 시뮬레이터 ─────────────────────────
function SavingSimulator({
  income,
  currentRate,
  currentPace,
}: {
  income: number
  currentRate: number
  currentPace: number
}) {
  const [rate, setRate] = useState(Math.round(currentRate * 100))
  const monthlySave = Math.round((income * rate) / 100)
  const tenYear = monthlySave * 120
  const currentTenYear = currentPace * 120
  const diff = tenYear - currentTenYear
  const nowRate = Math.round(currentRate * 100)

  return (
    <Card>
      <p className="text-[15px] font-bold text-ink">저축률을 움직여 보세요 🎚</p>
      <p className="mt-1 text-[12.5px] text-cap">종잣돈은 소득이 아니라 저축률이 만들어요</p>

      <div className="mt-4 flex items-end justify-between">
        <span className="tnum text-[32px] font-extrabold leading-none text-brand">{rate}%</span>
        <span className="tnum text-[13px] font-medium text-sub">
          월 {abbreviateKRW(monthlySave)} 저축
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={60}
        value={rate}
        onChange={(e) => setRate(Number(e.target.value))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-brand"
      />
      <div className="mt-1 flex justify-between text-[11px] text-cap">
        <span>0%</span>
        <span>지금 {nowRate}%</span>
        <span>60%</span>
      </div>

      <div className="mt-4 rounded-btn bg-bg p-3.5">
        <p className="text-[13px] font-medium text-sub">
          이 저축률이면 <b className="text-ink">10년 뒤 우리집 밑천</b>
        </p>
        <p className="tnum mt-1 text-[22px] font-extrabold text-ink">{abbreviateKRW(tenYear)}</p>
        {diff !== 0 && (
          <p className={`mt-1 text-[13px] font-bold ${diff > 0 ? 'text-brand' : 'text-danger'}`}>
            지금보다 {diff > 0 ? '+' : '−'}
            {abbreviateKRW(Math.abs(diff))} {diff > 0 ? '더 모아요 🔥' : '줄어요'}
          </p>
        )}
      </div>
    </Card>
  )
}

// ── ② 4기둥 한 줄 (탭하면 설명 펼침) ────────────
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
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i < score ? tone : 'bg-line'}`}
              />
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

// ── ③ 이번 주 할 일 (체크, 7일 유지) ────────────
const TASK_KEY = 'roadmap-weekly-task'
function WeeklyTask({ weakest }: { weakest: keyof Pillars }) {
  const action = PILLAR_INFO[weakest].action
  const [done, setDone] = useState(() => {
    try {
      const raw = localStorage.getItem(TASK_KEY)
      if (!raw) return false
      const o = JSON.parse(raw) as { action: string; ts: number }
      return o.action === action && Date.now() - o.ts < 7 * 864e5
    } catch {
      return false
    }
  })

  const toggle = () => {
    const next = !done
    setDone(next)
    if (next) localStorage.setItem(TASK_KEY, JSON.stringify({ action, ts: Date.now() }))
    else localStorage.removeItem(TASK_KEY)
  }

  return (
    <Card>
      <p className="text-[13px] font-bold text-cap">이번 주 할 일</p>
      <button onClick={toggle} className="mt-2 flex w-full items-center gap-3 text-left">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
            done ? 'border-brand bg-brand' : 'border-line'
          }`}
        >
          {done && <Check size={14} className="text-white" />}
        </span>
        <span
          className={`text-[14.5px] font-semibold ${done ? 'text-cap line-through' : 'text-ink'}`}
        >
          {action}
        </span>
      </button>
      {done && <p className="mt-2 text-[12.5px] font-medium text-brand">해냈어요! 이게 종잣돈이 돼요 🤍</p>}
    </Card>
  )
}
