import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { unseenBySpouse, useStocks } from '../lib/useStocks'

/** 자산 탭 → 주식 일지 입구 (2026-10-25). 배우자가 새로 남긴 기록이 있으면 숫자로 알려준다 */
export default function StockJournalCard() {
  const navigate = useNavigate()
  const { entries, me, stocks } = useStocks()
  const unseen = useMemo(
    () => Object.values(unseenBySpouse(entries, me)).reduce((a, n) => a + n, 0),
    [entries, me],
  )
  return (
    <button
      onClick={() => navigate('/stocks')}
      className="flex w-full items-center gap-3 rounded-card bg-card px-4 py-3.5 text-left shadow-card active:bg-line/40"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-[19px]">
        📒
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-ink">
          주식 일지
          {unseen > 0 && (
            <span className="ml-1.5 rounded-full bg-pink-50 px-2 py-0.5 align-[2px] text-[11px] font-bold text-pink-600">
              새 기록 {unseen}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[12.5px] text-sub">
          {stocks.length > 0
            ? `${stocks.length}종목 · 왜 샀는지, 얼마에 팔지 부부가 같이`
            : '캡처 한 장이면 우리집 주식이 정리돼요'}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-cap" />
    </button>
  )
}
