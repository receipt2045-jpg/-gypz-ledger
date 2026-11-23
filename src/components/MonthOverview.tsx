import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { summarize } from '../lib/carryover'
import { abbreviateKRW, formatMonthKorean } from '../lib/format'
import type { MonthlyLedger } from '../types'
import BudgetBars, { budgetCats } from './BudgetBars'
import { shortWon } from './StatGauges'

type Tile = 'fixed' | 'variable' | 'log'

/**
 * 가계부 탭 맨 위 요약 (2026-11-24 결영 요청 "난잡한 느낌, 직관적으로, 누르면 자세히" — 목업 A).
 * 남는 돈 한 줄 + 고정비·변동비·소비 기록 세 칸. 칸을 누르면 그 안 항목이 아래로 펼쳐진다.
 * 예전 링 네 개(MonthlyGlance)를 대신한다.
 */
export default function MonthOverview({
  ledger,
  confessed,
  logTotal,
  logCount,
  logDetail,
}: {
  ledger: MonthlyLedger
  /** (구성원:그룹:카테고리) → 이번 달 소비 기록 합계 */
  confessed: Map<string, number>
  /** 이번 달 소비 기록 — 쓴 돈 합계와 건수 */
  logTotal: number
  logCount: number
  /** 소비 기록 칸을 눌렀을 때 펼칠 내용 (누가 얼마) */
  logDetail: ReactNode
}) {
  const [open, setOpen] = useState<Tile | null>(null)
  const s = summarize(ledger)
  const save = s.saving + s.investment
  const settled = ledger.settledMembers ?? []
  const fixed = budgetCats(ledger.items, confessed, settled, ledger.closed, 'fixed')
  const variable = budgetCats(ledger.items, confessed, settled, ledger.closed, 'variable')
  const toggle = (t: Tile) => setOpen((cur) => (cur === t ? null : t))

  const tiles: { key: Tile; label: string; value: string; sub: string; over?: boolean }[] = [
    {
      key: 'fixed',
      label: '고정비',
      value: shortWon(s.fixed),
      sub: s.income > 0 ? `수입의 ${Math.round((s.fixed / s.income) * 100)}%` : '매달 나가는 돈',
    },
    {
      key: 'variable',
      label: '변동비',
      value: shortWon(variable.actual),
      sub: variable.planned > 0 ? `예산 ${shortWon(variable.planned)}` : '예산 없음',
      over: variable.planned > 0 && variable.actual > variable.planned,
    },
    {
      key: 'log',
      label: '소비 기록',
      value: shortWon(logTotal),
      sub: `${logCount}건`,
    },
  ]

  return (
    <div className="rounded-card bg-card px-5 py-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] text-sub">{formatMonthKorean(ledger.ym)} 남는 돈</p>
          <p
            className={`tnum text-[28px] font-extrabold tracking-tight ${
              s.surplus < 0 ? 'text-danger' : 'text-brand'
            }`}
          >
            {s.surplus < 0 ? `${shortWon(-s.surplus)}원 넘쳐요` : `${shortWon(s.surplus)}원`}
          </p>
        </div>
        <span className="mt-1 shrink-0 rounded-full bg-bg px-2.5 py-1 text-[11.5px] font-medium text-sub">
          {ledger.closed ? '정산 끝 · 실제' : '정산 전 · 계획 기준'}
        </span>
      </div>
      <p className="tnum mt-0.5 text-[12px] text-cap">
        수입 {shortWon(s.income)} − 저축 {shortWon(save)} − 고정 {shortWon(s.fixed)} − 변동{' '}
        {shortWon(s.variable)}
      </p>

      <div className="mt-3.5 grid grid-cols-3 gap-2">
        {tiles.map((t) => (
          <button
            key={t.key}
            onClick={() => toggle(t.key)}
            aria-expanded={open === t.key}
            aria-label={`${t.label} ${t.value}원 자세히`}
            className={`rounded-btn px-2.5 py-2.5 text-left ring-inset transition-colors ${
              open === t.key ? 'bg-brand/[0.07] ring-1 ring-brand/40' : 'bg-bg active:bg-line'
            }`}
          >
            <span className="flex items-center justify-between text-[12px] font-semibold text-sub">
              {t.label}
              <ChevronDown
                size={13}
                className={`text-cap transition-transform ${open === t.key ? 'rotate-180' : ''}`}
              />
            </span>
            <span
              className={`tnum mt-0.5 block whitespace-nowrap text-[17px] font-extrabold ${
                t.over ? 'text-danger' : 'text-ink'
              }`}
            >
              {t.value}
            </span>
            <span className="tnum block truncate text-[11px] text-cap">{t.sub}</span>
          </button>
        ))}
      </div>

      {open && (
        <div className="mt-3 border-t border-line pt-3">
          {open === 'log' ? (
            logDetail
          ) : (
            <>
              <BudgetBars
                items={ledger.items}
                confessed={confessed}
                settledMembers={settled}
                closed={ledger.closed}
                group={open}
              />
              {open === 'fixed' && fixed.cats.length > 0 && (
                <p className="mt-2 text-[11.5px] text-cap">
                  매달 같은 돈이 나가요 · 줄일 수 있는지는 아래 '고정비 점검'에서 봐요
                </p>
              )}
              {open === 'variable' && variable.planned > 0 && (
                <p
                  className={`mt-2 text-[12px] font-semibold ${
                    variable.actual > variable.planned ? 'text-danger' : 'text-brand'
                  }`}
                >
                  {variable.actual > variable.planned
                    ? `예산보다 ${abbreviateKRW(variable.actual - variable.planned)} 더 썼어요`
                    : `예산까지 ${abbreviateKRW(variable.planned - variable.actual)} 남았어요`}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
