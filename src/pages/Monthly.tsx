import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import SectionList from '../components/SectionList'
import { useLedgerStore } from '../lib/store'
import { activeYm, resolveLedger, summarize } from '../lib/carryover'
import { formatWon, formatYmKorean, shiftYm } from '../lib/format'
import { GROUP_LABEL, GROUP_ORDER } from '../lib/constants'
import type { CategoryGroup } from '../types'

type MemberFilter = 0 | 1 | 2 // 0 = 함께

export default function Monthly() {
  const { ledgers, profile } = useLedgerStore()
  const [ym, setYm] = useState(() => activeYm(ledgers))
  const [member, setMember] = useState<MemberFilter>(0)

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
          <span className="text-[15px] font-semibold text-white/80">잉여현금</span>
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
