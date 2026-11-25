import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { openShare } from './ShareMore'
import {
  SHARE_CATEGORIES,
  isNewShare,
  shareDate,
  sharesByDate,
  type ShareCategory,
} from '../lib/shares'
import { useShareViews, viewsLabel } from '../lib/shareViews'

/**
 * 돈 공부 탭 '자료 나눔' — 새로 올라온 3개 (토스피드 번호 목록) + 전체 보기.
 * 2026-11-21 분류 칩: 고르면 그 분류 새 자료 3개, 전체 보기도 그 분류로(#/share?c=육아).
 */
export default function ShareList({ count = 3 }: { count?: number } = {}) {
  const navigate = useNavigate()
  const views = useShareViews()
  const [cat, setCat] = useState<ShareCategory | null>(null)
  const list = sharesByDate().filter((s) => !cat || s.category === cat)
  const toAll = cat ? `/share?c=${encodeURIComponent(cat)}` : '/share'
  return (
    <section aria-label="자료 나눔" className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-[13px] font-bold text-sub">결영이네 자료 나눔</p>
        <button
          onClick={() => openShare(navigate, toAll)}
          className="flex items-center text-[12.5px] font-bold text-brand active:opacity-60"
        >
          전체 보기 <ChevronRight size={14} />
        </button>
      </div>
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {[null, ...SHARE_CATEGORIES].map((c) => (
          <button
            key={c ?? '전체'}
            onClick={() => setCat(c)}
            aria-pressed={cat === c}
            className={`shrink-0 rounded-full px-3 py-1 text-[12.5px] font-bold transition-colors ${
              cat === c ? 'bg-ink text-white' : 'bg-white text-sub shadow-card active:bg-line'
            }`}
          >
            {c ?? '전체'}
          </button>
        ))}
      </div>
      <ol className="rounded-card bg-white px-4 shadow-card">
        {list.slice(0, count).map((s, i) => (
          <li key={s.slug} className="border-b border-line last:border-b-0">
            <button
              onClick={() => openShare(navigate, s.path)}
              className="flex w-full items-center gap-3 py-3.5 text-left active:opacity-60"
            >
              <span className="tnum w-3 shrink-0 text-[15px] font-bold text-brand">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-bold text-ink">
                  {s.title}
                  {isNewShare(s) && (
                    <span className="ml-1.5 rounded bg-danger px-1 py-px align-[2px] text-[9.5px] font-bold text-white">
                      NEW
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[12px] text-cap">
                  {s.category} · {shareDate(s.date)}
                  {viewsLabel(views[s.slug]) && ` · ${viewsLabel(views[s.slug])}이 봤어요`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
