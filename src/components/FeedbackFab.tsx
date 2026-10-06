import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { MessageCircle, X } from 'lucide-react'
import FeedbackCard from './FeedbackCard'

/**
 * 어느 화면에서나 '의견 보내기' (2026-10-06, 재개발뷰 참고).
 * 예전엔 설정 맨 아래에만 있었다. 오른쪽 아래 작은 버튼 → 아래에서 올라오는 창.
 * 어느 화면에서 보냈는지(주소)를 같이 남긴다.
 */
export default function FeedbackFab() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[92px] right-[max(1rem,calc(50%-240px+1rem))] z-30 flex items-center gap-1 rounded-full border border-line bg-white/95 px-3 py-2 text-[12px] font-bold text-sub shadow-card backdrop-blur active:bg-bg lg:bottom-6 lg:right-6"
      >
        <MessageCircle size={14} /> 의견 보내기
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 lg:items-center"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="의견 보내기"
        >
          <div
            className="relative w-full max-w-app rounded-t-card bg-bg p-4 pb-8 lg:rounded-card lg:pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              aria-label="닫기"
              className="absolute right-6 top-7 z-10 text-cap"
            >
              <X size={20} />
            </button>
            <FeedbackCard screen={pathname} />
          </div>
        </div>
      )}
    </>
  )
}
