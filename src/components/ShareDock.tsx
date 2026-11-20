import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Check, Eye, Share2 } from 'lucide-react'
import {
  fetchShareViews,
  recordShareView,
  shareItem,
  shareOfPath,
  viewsLabel,
} from '../lib/shareViews'

/**
 * 자료 화면 맨 아래에 붙는 바 (2026-11-21) — 몇 명이 봤는지 + 이 자료 공유하기.
 * 자료마다 화면 짜임이 달라서 페이지마다 붙이지 않고, 주소가 자료면 여기 하나로 띄운다.
 * 자료를 열면 본 사람으로 한 번 센다.
 */
export default function ShareDock() {
  const { pathname } = useLocation()
  const item = shareOfPath(pathname)
  const [views, setViews] = useState<number | undefined>(undefined)
  const [done, setDone] = useState<'copied' | null>(null)

  useEffect(() => {
    setDone(null)
    if (!item) return
    recordShareView(item.slug)
    let alive = true
    void fetchShareViews().then((c) => alive && setViews(c[item.slug]))
    return () => {
      alive = false
    }
  }, [item])

  if (!item) return null
  const label = viewsLabel(views)

  const share = async () => {
    const r = await shareItem(item)
    if (r === 'copied') {
      setDone('copied')
      setTimeout(() => setDone(null), 2000)
    }
  }

  return (
    <>
      {/* 바에 글 끝이 가려지지 않게 */}
      <div aria-hidden className="h-20" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-app items-center gap-3 px-5 py-3 lg:max-w-[720px]">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-bold text-ink">도움 됐다면 나눠 주세요</p>
            <p className="flex items-center gap-1 text-[12px] text-cap">
              {label ? (
                <>
                  <Eye size={13} /> {label}이 봤어요
                </>
              ) : (
                '카톡·인스타로 바로 보낼 수 있어요'
              )}
            </p>
          </div>
          <button
            onClick={() => void share()}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-btn bg-ink px-4 text-[14px] font-bold text-white active:opacity-90"
          >
            {done ? <Check size={16} /> : <Share2 size={16} />}
            {done ? '링크 복사됨' : '공유하기'}
          </button>
        </div>
      </div>
    </>
  )
}
