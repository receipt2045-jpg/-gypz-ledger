import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import BudgetBars from '../components/BudgetBars'
import InfoTip from '../components/InfoTip'
import SectionList from '../components/SectionList'
import { useLedgerStore } from '../lib/store'
import { activeYm, resolveLedger, summarize } from '../lib/carryover'
import { formatWon, formatYmKorean, shiftYm } from '../lib/format'
import { GROUP_LABEL, GROUP_ORDER, TERM_TIP } from '../lib/constants'
import type { CategoryGroup } from '../types'

type MemberFilter = 0 | 1 | 2 // 0 = 함께

const BANNER_KEY = 'gypz-concept-banner-closed'

export default function Monthly() {
  const navigate = useNavigate()
  const { ledgers, profile } = useLedgerStore()
  const [ym, setYm] = useState(() => activeYm(ledgers))
  const [member, setMember] = useState<MemberFilter>(0)
  // 개념 안내 배너 (브리프 P0 1.2) — 닫으면 이 기기에서 다시 안 뜸
  const [showBanner, setShowBanner] = useState(() => !localStorage.getItem(BANNER_KEY))
  const closeBanner = () => {
    localStorage.setItem(BANNER_KEY, '1')
    setShowBanner(false)
  }

  const ledger = resolveLedger(ledgers, ym)
  const memberNames: [string, string] = [profile.member1Name, profile.member2Name]

  const filteredItems =
    member === 0 ? ledger.items : ledger.items.filter((it) => it.member === member)
  const filteredLedger = { ...ledger, items: filteredItems }
  const s = summarize(filteredLedger)

  const goodWhenOver = (g: CategoryGroup) =>
    g === 'income' || g === 'saving' || g === 'investment'

  const tabs: { key: MemberFilter; label: string }[] = [
    { key: 0, label: '함께 보기' },
    { key: 1, label: profile.member1Name },
    { key: 2, label: profile.member2Name },
  ]

  return (
    <div className="animate-fade-up space-y-4">
      {/* 개념 안내 배너 */}
      {showBanner && (
        <div className="flex items-start justify-between gap-3 rounded-card bg-brand/10 px-4 py-3">
          <div>
            <p className="text-[14px] font-bold text-ink">매일 적는 앱이 아니에요 ❗️</p>
            <p className="mt-0.5 text-[13px] text-sub">
              월말에 '정산하기'로 한 번에 정리합니다
            </p>
          </div>
          <button onClick={closeBanner} className="shrink-0 pt-0.5 text-cap" aria-label="배너 닫기">
            <X size={17} />
          </button>
        </div>
      )}

      {/* 월 선택 */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <button
          onClick={() => setYm(shiftYm(ym, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-sub active:bg-line"
          aria-label="이전 달"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="min-w-[128px] text-center text-[18px] font-bold text-ink">
          {formatYmKorean(ym)}
        </h1>
        <button
          onClick={() => setYm(shiftYm(ym, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full text-sub active:bg-line"
          aria-label="다음 달"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {!ledger.closed && (
        <p className="-mt-1 text-center text-[12px] font-medium text-cap">
          아직 정산 전이에요 · 계획 금액 기준
        </p>
      )}

      {/* 기록하기 — 예산 세우기(월초) / 정산하기(월말) */}
      <div className="flex gap-2">
        <button
          onClick={() => navigate('/checkup', { state: { ym, mode: 'budget' } })}
          className="h-12 flex-1 rounded-btn bg-white text-[14px] font-bold text-ink shadow-card active:bg-line"
        >
          📝 예산 세우기
        </button>
        <button
          onClick={() => navigate('/checkup', { state: { ym, mode: 'settle' } })}
          className="h-12 flex-1 rounded-btn bg-brand text-[14px] font-bold text-white shadow-cta active:bg-brand-dark"
        >
          ✅ {formatYmKorean(ym).split(' ')[1]} 정산하기
        </button>
      </div>

      {/* 예산 대비 지출 */}
      <div className="rounded-card bg-card px-5 py-4 shadow-card">
        <h3 className="mb-3 text-[15px] font-bold text-ink">예산 대비 지출</h3>
        <BudgetBars items={ledger.items} />
      </div>

      {/* 부부 토글 */}
      <div className="flex gap-1 rounded-btn bg-line/60 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setMember(t.key)}
            className={`flex-1 rounded-[10px] py-2 text-[14px] font-semibold transition-colors ${
              member === t.key ? 'bg-white text-ink shadow-card' : 'text-sub'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 섹션별 리스트 */}
      <div className="space-y-3">
        {GROUP_ORDER.map((g) => (
          <SectionList
            key={g}
            title={GROUP_LABEL[g]}
            items={filteredItems.filter((it) => it.group === g)}
            closed={ledger.closed}
            goodWhenOver={goodWhenOver(g)}
            memberNames={memberNames}
          />
        ))}
      </div>

      {/* 잉여현금 */}
      <div className="rounded-card bg-ink px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <span className="flex items-center text-[15px] font-semibold text-white/80">
            잉여현금
            <InfoTip text={TERM_TIP.surplus} />
          </span>
          <span className={`tnum text-[20px] font-extrabold ${s.surplus < 0 ? 'text-[#FF8A93]' : 'text-white'}`}>
            {formatWon(s.surplus)}
          </span>
        </div>
        <p className="mt-1 text-[12px] text-white/55">
          수입 − 저축 − 투자 − 지출 기준
        </p>
      </div>
    </div>
  )
}
