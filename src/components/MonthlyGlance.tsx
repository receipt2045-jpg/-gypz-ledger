import { summarize } from '../lib/carryover'
import { formatMonthKorean } from '../lib/format'
import type { MonthlyLedger } from '../types'
import { Ring, shortWon } from './StatGauges'

/**
 * 가계부 탭 '한눈에' (2026-10-07 제보: "한눈에 안 들어와요").
 * 맨 위에 남는 돈, 그 아래 홈 탭처럼 링 네 개(수입·저축·투자·고정비·생활비).
 * 항목별 목록은 이 아래 '자세히'에서 펼쳐 본다. ('누가 얼마나 벌었나'는 빼 달라고 해서 뺐다)
 */
export default function MonthlyGlance({ ledger }: { ledger: MonthlyLedger }) {
  const s = summarize(ledger)
  const save = s.saving + s.investment
  const pct = (n: number) => (s.income > 0 ? Math.round((n / s.income) * 100) : 0)
  const ratio = (n: number) => (s.income > 0 ? n / s.income : 0)

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
        수입 {shortWon(s.income)} − 저축·투자 {shortWon(save)} − 고정비 {shortWon(s.fixed)} − 생활비{' '}
        {shortWon(s.variable)}
      </p>

      <div className="mt-4 grid grid-cols-4 gap-1">
        <Ring ratio={1} value={shortWon(s.income)} label="수입" color="#3182F6" />
        <Ring
          ratio={ratio(save)}
          value={shortWon(save)}
          label="저축·투자"
          sub={`수입의 ${pct(save)}%`}
          color="#22C55E"
        />
        <Ring
          ratio={ratio(s.fixed)}
          value={shortWon(s.fixed)}
          label="고정비"
          sub={`수입의 ${pct(s.fixed)}%`}
          color={ratio(s.fixed) > 0.5 ? '#FF6B6B' : '#F5A623'}
        />
        <Ring
          ratio={ratio(s.variable)}
          value={shortWon(s.variable)}
          label="생활비"
          sub={`수입의 ${pct(s.variable)}%`}
          color="#8B5CF6"
        />
      </div>
    </div>
  )
}
