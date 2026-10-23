import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { openShare } from './ShareMore'
import { isNewShare, shareDate, sharesByDate } from '../lib/shares'

/** 돈 공부 탭 '자료 나눔' — 새로 올라온 3개 (토스피드 번호 목록) + 전체 보기 */
export default function ShareList() {
  const navigate = useNavigate()
  return (
    <section aria-label="자료 나눔" className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-[13px] font-bold text-sub">결영이네 자료 나눔</p>
        <button
          onClick={() => openShare(navigate, '/share')}
          className="flex items-center text-[12.5px] font-bold text-brand active:opacity-60"
        >
          전체 보기 <ChevronRight size={14} />
        </button>
      </div>
      <ol className="rounded-card bg-white px-4 shadow-card">
        {sharesByDate()
          .slice(0, 3)
          .map((s, i) => (
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
                  </span>
                </span>
              </button>
            </li>
          ))}
      </ol>
    </section>
  )
}
