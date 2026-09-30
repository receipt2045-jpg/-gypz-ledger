import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, X } from 'lucide-react'

const SEEN_KEY = 'moabuli.newFeature.leave'

function readSeen(): boolean {
  try {
    return !!localStorage.getItem(SEEN_KEY)
  } catch {
    return false
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* 시크릿 모드 — 다음에 또 보일 뿐이다 */
  }
}

/**
 * 새로운 기능 알림 — 육아휴직 계산기(2026-09-30).
 * 이미 가계부를 쓰는 사람은 계산기가 생긴 걸 모른다. 홈 맨 위에 한 번 알리고,
 * 닫거나 들어가 보면 다시 뜨지 않는다.
 */
export default function NewFeatureBanner() {
  const navigate = useNavigate()
  const [seen, setSeen] = useState(readSeen)
  if (seen) return null

  const close = () => {
    markSeen()
    setSeen(true)
  }

  return (
    <div className="relative rounded-card bg-white px-4 py-3.5">
      <button
        onClick={close}
        aria-label="알림 닫기"
        className="absolute right-2.5 top-2.5 text-cap active:opacity-60"
      >
        <X size={15} />
      </button>
      <span className="inline-block rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
        새로운 기능
      </span>
      <p className="mt-1.5 pr-6 text-[14.5px] font-bold text-ink">🍼 육아휴직 계산기가 나왔어요</p>
      <p className="mt-1 pr-6 text-[12.5px] leading-relaxed text-sub">
        휴직하면 우리집에 달마다 얼마가 모이는지, 내 가계부 숫자로 바로 계산해봐요
      </p>
      <button
        onClick={() => {
          markSeen()
          navigate('/leave')
        }}
        className="mt-2.5 flex w-full items-center justify-between rounded-btn bg-brand px-3.5 py-2.5 text-white active:bg-brand-dark"
      >
        <span className="text-[13.5px] font-bold">계산해보기</span>
        <ChevronRight size={17} className="shrink-0" />
      </button>
    </div>
  )
}
