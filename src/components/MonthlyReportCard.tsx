import { useState } from 'react'
import { Share2 } from 'lucide-react'
import { shareCard } from '../lib/cardImage'
import { abbreviateKRW, formatWon, formatYmKorean } from '../lib/format'
import type { MonthlyCardData } from '../lib/monthlyCard'

/**
 * 이번 달 성적표 — 화면 미리보기 + 이미지 공유.
 *
 * 미리보기는 HTML, 공유 이미지는 canvas로 따로 그린다(CSP가 외부 캡처
 * 라이브러리를 막는다). 두 곳의 숫자는 buildMonthlyCard 하나에서 온다.
 */
export default function MonthlyReportCard({ data }: { data: MonthlyCardData }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'shared' | 'saved' | 'failed' | null>(null)

  const onShare = async () => {
    if (busy) return
    setBusy(true)
    setDone(await shareCard(data))
    setBusy(false)
  }

  const up = data.netWorthDelta >= 0
  const pct = Math.round(data.savingInvestRate * 100)

  return (
    <div className="mt-4 w-full">
      <div className="rounded-card bg-white px-5 py-6 text-center shadow-card">
        <p className="text-[13px] font-medium text-cap">
          {formatYmKorean(data.ym)} 우리집 성적표
        </p>

        <p className="mt-4 text-[14px] font-bold text-sub">저축 · 투자율</p>
        <p className="tnum text-[54px] font-extrabold leading-tight text-brand">{pct}%</p>
        <p className="text-[12.5px] text-cap">{formatWon(data.savingInvest)} 모았어요</p>

        <div className="mt-4 space-y-2 border-t border-line pt-4 text-left">
          <Row label="순자산" value={abbreviateKRW(data.netWorth)} danger={data.netWorth < 0} />
          <Row
            label="지난달보다"
            value={`${up ? '+' : '−'}${abbreviateKRW(Math.abs(data.netWorthDelta))}`}
            accent={up}
            danger={!up}
          />
          <Row label="잉여현금" value={formatWon(data.surplus)} danger={data.surplus < 0} />
          <Row label={data.memberNames[0]} value={formatWon(data.memberSaving[0])} />
          <Row label={data.memberNames[1]} value={formatWon(data.memberSaving[1])} />
        </div>

        <p className="mt-4 text-[13.5px] font-semibold leading-relaxed text-sub">
          {data.headline}
        </p>
      </div>

      <button
        onClick={onShare}
        disabled={busy}
        className="mt-2.5 flex h-12 w-full items-center justify-center gap-1.5 rounded-btn bg-ink text-[14.5px] font-bold text-white active:opacity-90 disabled:opacity-60"
      >
        <Share2 size={17} />
        {busy ? '만드는 중…' : '이미지로 공유하기'}
      </button>
      {done === 'saved' && (
        <p className="mt-1.5 text-center text-[12px] text-cap">이미지로 저장했어요</p>
      )}
      {done === 'failed' && (
        <p className="mt-1.5 text-center text-[12px] text-danger">
          이미지를 만들지 못했어요. 잠시 후 다시 시도해 주세요
        </p>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  accent,
  danger,
}: {
  label: string
  value: string
  accent?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13.5px] text-cap">{label}</span>
      <span
        className={`tnum text-[15px] font-bold ${
          danger ? 'text-danger' : accent ? 'text-brand' : 'text-ink'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
