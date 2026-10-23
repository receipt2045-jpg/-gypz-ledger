import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Hourglass } from 'lucide-react'
import OneTeamCard from '../components/OneTeamCard'
import SiteFooter from '../components/SiteFooter'
import { openShare } from '../components/ShareMore'
import { useLedgerStore } from '../lib/store'
import {
  SHARE_CATEGORIES,
  isNewShare,
  shareDate,
  sharesByDate,
  type ShareCategory,
  type ShareItem,
} from '../lib/shares'

/**
 * 결영이네 자료 나눔 (2026-10-24) — 로그인 없이 열리는 공개 목록. 단톡방 공지에 이 링크 하나만 걸어 둔다.
 * 생김새는 토스피드를 따랐다: 가운데 제목 → 번호 붙은 '새로 올라온 자료' → 분류 칩 → 큰 카드.
 */
export default function Share() {
  const navigate = useNavigate()
  const inApp = useLedgerStore((st) => st.status === 'ready')
  const [cat, setCat] = useState<ShareCategory | null>(null)
  const all = sharesByDate()
  const shown = cat ? all.filter((s) => s.category === cat) : all
  const open = (s: ShareItem) => openShare(navigate, s.path)

  return (
    <div className="flex min-h-screen justify-center bg-white break-keep">
      <div className="w-full max-w-app">
        <div className="px-5 pb-10 pt-6">
          {inApp && (
            <button
              onClick={() => navigate('/info')}
              className="-ml-1 flex items-center gap-0.5 text-[14px] font-semibold text-sub"
            >
              <ChevronLeft size={19} />돈 공부
            </button>
          )}

          <header className="pt-6 text-center">
            <h1 className="text-[26px] font-extrabold text-ink">결영이네 자료 나눔</h1>
            <p className="mt-1.5 text-[15px] text-sub">단톡방에서 나눈 자료, 여기 다 모아뒀어요</p>
          </header>

          {/* 토스피드 '지금 많이 보는 콘텐츠'처럼 — 번호 + 제목 */}
          <section aria-label="새로 올라온 자료" className="mt-10">
            <h2 className="text-center text-[20px] font-extrabold text-ink">새로 올라온 자료</h2>
            <ol className="mt-4">
              {all.slice(0, 3).map((s, i) => (
                <li key={s.slug} className="border-b border-line last:border-b-0">
                  <button
                    onClick={() => open(s)}
                    className="flex w-full items-center gap-4 py-4 text-left active:opacity-60"
                  >
                    <span className="tnum w-3 shrink-0 text-[17px] font-bold text-brand">
                      {i + 1}
                    </span>
                    <span className="text-[16px] font-bold leading-snug text-ink">{s.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <section aria-label="전체 자료" className="mt-10">
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
              {[null, ...SHARE_CATEGORIES].map((c) => (
                <button
                  key={c ?? '전체'}
                  onClick={() => setCat(c)}
                  aria-pressed={cat === c}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-bold transition-colors ${
                    cat === c ? 'bg-ink text-white' : 'bg-bg text-sub active:bg-line'
                  }`}
                >
                  {c ?? '전체'}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-9">
              {shown.map((s) => (
                <button key={s.slug} onClick={() => open(s)} className="block w-full text-left">
                  <div
                    className={`relative flex aspect-[16/9] items-center justify-center rounded-2xl ${s.tint}`}
                  >
                    <span className="text-[64px]" aria-hidden>
                      {s.emoji}
                    </span>
                    {isNewShare(s) && (
                      <span className="absolute left-3 top-3 rounded bg-danger px-2 py-0.5 text-[11px] font-bold text-white">
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-[18px] font-extrabold leading-snug text-ink">{s.title}</p>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-sub">{s.sub}</p>
                  <p className="mt-1.5 flex items-center gap-1 text-[13px] text-cap">
                    <Hourglass size={13} />
                    {s.minutes}분 · {s.category} · {shareDate(s.date)}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <div className="mt-12">
            <OneTeamCard onStory={() => navigate('/story')} />
          </div>
          {!inApp && (
            <a
              href="#/"
              className="mt-3 flex w-full items-center justify-center gap-0.5 py-3 text-[14px] font-bold text-brand"
            >
              모아불리 가계부 둘러보기
              <ChevronRight size={16} />
            </a>
          )}
        </div>
        <SiteFooter />
      </div>
    </div>
  )
}
