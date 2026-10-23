import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { logReco, markSeen, type RecoCard as Card, type RecoSlot } from '../lib/reco'

/**
 * 맞춤 추천 카드 한 장 — 소비 기록 직후·정산 완료 화면 (2026-10-24).
 * 보이면 '오늘 봄'으로 표시하고 기록을 남긴다. 누르면 한 번 더 남긴다.
 */
export default function RecoCard({ card, slot }: { card: Card; slot: RecoSlot }) {
  const navigate = useNavigate()
  useEffect(() => {
    markSeen(card.id)
    logReco(slot, card.id, 'view')
  }, [card.id, slot])

  const click = () => logReco(slot, card.id, 'click')
  const btn =
    'mt-3 flex w-full items-center justify-center gap-1 rounded-btn bg-brand py-3 text-[14px] font-bold text-white active:bg-brand-dark'

  return (
    <div className="w-full rounded-card border-[1.5px] border-brand/50 bg-card px-4 py-4 text-left shadow-card">
      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
        {card.tag}
      </span>
      <p className="mt-2 whitespace-pre-line text-[16px] font-extrabold leading-snug text-ink">
        {card.title}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-sub">{card.body}</p>
      {card.href ? (
        <a
          href={card.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={click}
          className={btn}
        >
          {card.cta}
          <ChevronRight size={16} />
        </a>
      ) : (
        <button
          onClick={() => {
            click()
            if (card.to) navigate(card.to)
          }}
          className={btn}
        >
          {card.cta}
          <ChevronRight size={16} />
        </button>
      )}
      {card.sub && (
        <button
          onClick={() => {
            logReco(slot, `${card.id}:sub`, 'click')
            navigate(card.sub!.to)
          }}
          className="mt-2.5 flex w-full items-center justify-center gap-0.5 text-[12.5px] font-bold text-sub active:text-ink"
        >
          {card.sub.label}
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  )
}
