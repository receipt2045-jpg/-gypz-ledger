import { useNavigate } from 'react-router-dom'
import { ChevronRight, Lock, Sparkles } from 'lucide-react'
import Card from '../components/Card'
import { useLedgerStore } from '../lib/store'
import { netWorthOf, resolveLedger, resolveSnapshot, summarize } from '../lib/carryover'
import { abbreviateKRW, currentYm, formatPercent } from '../lib/format'
import { STAGES, computePillars, currentStageIndex, diagnose } from '../lib/roadmap'

// 전환 링크 — 결영이네가 직접 운영 (원팀 프로젝트 / 1:1 상담)
const ONETEAM_URL = 'https://oneteamm.netlify.app/'
const CONSULT_URL = 'https://oneteamm.netlify.app/' // TODO: 1:1 상담 예약/카톡 링크로 교체

export default function Roadmap() {
  const navigate = useNavigate()
  const { ledgers, snapshots, profile } = useLedgerStore()

  const latestYm = ledgers.length ? ledgers[ledgers.length - 1].ym : currentYm()
  const ledger = resolveLedger(ledgers, latestYm)
  const s = summarize(ledger)
  const snapshot = resolveSnapshot(snapshots, latestYm)
  const netWorth = netWorthOf(snapshot)

  const pace = s.saving + s.investment // 월 저축·투자 납입 = 종잣돈 속도
  const tenYearSeed = pace * 120 // 이 속도로 10년간 모을 종잣돈

  const pillars = computePillars(ledger, s)
  const diag = diagnose(pillars)
  const stageIdx = currentStageIndex(s.income, pace, netWorth, profile.targetNetWorth)

  const hasData = s.income > 0 || snapshot.items.length > 0

  return (
    <div className="animate-fade-up space-y-4 pb-24">
      {/* ── 목적지 헤더 ───────────────────────── */}
      <header className="px-1 pt-2">
        <div className="flex items-center gap-2">
          <span className="text-[22px]">🏠</span>
          <h1 className="text-[20px] font-extrabold tracking-tight text-ink">우리집까지 가는 길</h1>
        </div>
        {pace > 0 ? (
          <>
            <div className="mt-3 flex items-end gap-2">
              <span className="tnum text-[30px] font-extrabold leading-none text-brand">
                저축률 {formatPercent(s.savingInvestRate)}
              </span>
            </div>
            <p className="mt-2.5 text-[13.5px] font-medium leading-relaxed text-sub">
              이번 달 종잣돈 <b className="tnum text-ink">+{abbreviateKRW(pace)}</b> 🔥 이 속도라면
              10년에 <b className="tnum text-brand">{abbreviateKRW(tenYearSeed)}</b>이 우리집 밑천이
              돼요.
            </p>
          </>
        ) : (
          <p className="mt-3 text-[14px] font-medium text-sub">
            {hasData
              ? '아직 저축·투자 기록이 없어요. 매달 모으는 돈이 우리집 연료예요 🔥'
              : '먼저 예산을 세우면 우리집까지 가는 길이 그려져요.'}
          </p>
        )}
      </header>

      {/* 데이터가 없으면 시작 안내 */}
      {!hasData && (
        <Card onClick={() => navigate('/monthly')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold text-ink">가계부부터 시작해요</p>
              <p className="mt-1 text-[13px] text-sub">
                예산을 세우고 정산하면 로드맵이 자동으로 채워져요
              </p>
            </div>
            <ChevronRight size={18} className="shrink-0 text-cap" />
          </div>
        </Card>
      )}

      {/* ── 우리 팀 상태 (방어/공격 4기둥) ────────── */}
      <Card>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[15px] font-bold text-ink">우리 팀 상태</p>
          <span className="text-[12px] font-medium text-cap">통장은 각자, 돈관리는 같이</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <PillarRow icon="🛡" label="절약" score={pillars.reduce} tone="defense" />
          <PillarRow icon="🛡" label="절세" score={pillars.protect} tone="defense" />
          <PillarRow icon="⚔️" label="부수입" score={pillars.side} tone="offense" />
          <PillarRow icon="⚔️" label="투자" score={pillars.invest} tone="offense" />
        </div>

        {/* 결영이네 관점 한 줄 */}
        <div className="mt-4 flex gap-2 rounded-btn bg-bg p-3">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-brand" />
          <p className="text-[13.5px] font-medium leading-relaxed text-sub">{diag.headline}</p>
        </div>
      </Card>

      {/* ── 빈 곳 진단 → 전환 CTA ────────────────── */}
      {hasData && (
        <Card>
          {diag.offenseGap ? (
            <>
              <p className="text-[15px] font-bold text-ink">
                우리 팀의 빈 곳:{' '}
                <span className="text-danger">공격({diag.weakestLabel})</span>
              </p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-sub">
                절약은 되고 있어요. 그런데 부수입·투자가 비면 종잣돈이 느리게 쌓여요. 이건 혼자
                뚫기 어려운 부분이라, 시스템을 통째로 바꾸는 게 빨라요.
              </p>
              <PrimaryLink href={ONETEAM_URL}>원팀 프로젝트로 공격 뚫기 →</PrimaryLink>
              <SecondaryLink href={CONSULT_URL}>1:1로 우리 경로 그리기</SecondaryLink>
            </>
          ) : (
            <>
              <p className="text-[15px] font-bold text-ink">다음 갈림길이 다가와요</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-sub">
                종잣돈이 쌓이면 곧 “청약이냐 매매냐, 대출은 얼마냐”를 정해야 해요. 원리는
                알려드릴 수 있지만, <b className="text-ink">우리만의 답</b>은 숫자만으론 안 나와요.
              </p>
              <PrimaryLink href={CONSULT_URL}>1:1로 우리 경로 그리기 →</PrimaryLink>
              <SecondaryLink href={ONETEAM_URL}>원팀 프로젝트 알아보기</SecondaryLink>
            </>
          )}
        </Card>
      )}

      {/* ── 내집마련 여정 (단계 스텝퍼) ───────────── */}
      <div className="px-1 pt-1">
        <p className="mb-1 text-[13px] font-bold text-cap">내집마련 여정</p>
      </div>
      <div className="space-y-2.5">
        {STAGES.map((stage, i) => {
          const state: 'done' | 'current' | 'locked' =
            i < stageIdx ? 'done' : i === stageIdx ? 'current' : 'locked'
          return (
            <div
              key={stage.key}
              className={`rounded-card border p-4 ${
                state === 'current'
                  ? 'border-brand bg-brand/[0.04]'
                  : 'border-line bg-card'
              }`}
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

                  {/* 상담에서 여는 것 (열린 고리) */}
                  {stage.open && (
                    <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-bg px-2.5 py-2">
                      <Lock size={13} className="mt-0.5 shrink-0 text-cap" />
                      <p className="text-[12.5px] font-medium leading-relaxed text-cap">
                        {stage.open}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 하단 상담 유도 */}
      <Card className="!bg-ink">
        <p className="text-[15px] font-bold text-white">우리 부부의 진짜 경로가 궁금하다면</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
          앱은 관점을 드려요. 우리집까지의 구체적인 지도는 결영이네와 함께 그려요.
        </p>
        <a
          href={CONSULT_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex h-12 w-full items-center justify-center rounded-btn bg-brand text-[15px] font-bold text-white shadow-cta active:bg-brand-dark"
        >
          1:1 상담 신청하기
        </a>
      </Card>
    </div>
  )
}

// ── 방어/공격 기둥 한 줄 (도트 미터) ───────────
function PillarRow({
  icon,
  label,
  score,
  tone,
}: {
  icon: string
  label: string
  score: number
  tone: 'defense' | 'offense'
}) {
  const empty = score === 0
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold text-ink">
          {icon} {label}
        </span>
        {empty && <span className="text-[11px] font-bold text-danger">비어있음</span>}
      </div>
      <div className="mt-1.5 flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-full ${
              i < score ? (tone === 'defense' ? 'bg-brand' : 'bg-ink') : 'bg-line'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

// ── 전환 버튼 ──────────────────────────────────
function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="mt-3 flex h-12 w-full items-center justify-center rounded-btn bg-brand text-[15px] font-bold text-white shadow-cta active:bg-brand-dark"
    >
      {children}
    </a>
  )
}
function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="mt-2 flex h-11 w-full items-center justify-center rounded-btn bg-white text-[14px] font-semibold text-ink shadow-card active:bg-line"
    >
      {children}
    </a>
  )
}
