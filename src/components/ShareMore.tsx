import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { isNewShare, otherShares, type ShareItem } from '../lib/shares'

/**
 * 자료 맨 끝 '이런 자료도 있어요' (2026-10-24, 토스피드 '관련 콘텐츠' 따라) —
 * 공유 링크(#/gold)로 들어온 사람이 다른 자료로 이어서 넘어가게.
 * 지금 보는 자료는 주소로 알아서 뺀다.
 */
/** wide: PC에서 네 칸 (자료 글 맨 끝처럼 넓은 자리) */
export default function ShareMore({ wide = false }: { wide?: boolean }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const items = otherShares(pathname, 4)
  if (items.length === 0) return null

  return (
    <section aria-label="다른 자료" className="pt-2">
      <h2 className="px-1 text-[19px] font-extrabold text-ink">이런 자료도 있어요</h2>
      <div
        className={`mt-3 grid grid-cols-2 gap-x-3 gap-y-5 ${wide ? 'lg:grid-cols-4 lg:gap-x-5' : ''}`}
      >
        {items.map((s) => (
          <ShareTile key={s.slug} item={s} onOpen={() => openShare(navigate, s.path)} />
        ))}
      </div>
      <button
        onClick={() => openShare(navigate, '/share')}
        className={`mt-5 flex w-full items-center justify-center gap-0.5 rounded-btn bg-white py-3.5 ${wide ? 'lg:mx-auto lg:max-w-[360px]' : ''} text-[14px] font-bold text-ink shadow-card active:bg-line`}
      >
        결영이네 자료 나눔 전체 보기
        <ChevronRight size={16} />
      </button>
    </section>
  )
}

/** 다른 자료로 — 맨 끝에서 눌렀으니 새 자료는 맨 위부터 보이게 */
export function openShare(navigate: (to: string) => void, to: string) {
  navigate(to)
  window.scrollTo(0, 0)
}

/** 썸네일 위, 분류(회색 작은 글씨), 제목(굵게) — 토스피드 관련 콘텐츠 카드 */
export function ShareTile({ item, onOpen }: { item: ShareItem; onOpen: () => void }) {
  return (
    <button onClick={() => onOpen()} className="text-left active:opacity-70">
      <div
        className={`relative flex aspect-[3/2] items-center justify-center rounded-xl ${item.tint}`}
      >
        <span className="text-[40px]" aria-hidden>
          {item.emoji}
        </span>
        {isNewShare(item) && (
          <span className="absolute left-2 top-2 rounded bg-danger px-1.5 py-px text-[10px] font-bold text-white">
            NEW
          </span>
        )}
      </div>
      <p className="mt-2 text-[12.5px] text-cap">{item.category}</p>
      <p className="mt-0.5 line-clamp-2 text-[15px] font-bold leading-snug text-ink">
        {item.title}
      </p>
    </button>
  )
}
