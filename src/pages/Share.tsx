import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Eye, Hourglass, Share2 } from 'lucide-react'
import OneTeamCard from '../components/OneTeamCard'
import SiteFooter from '../components/SiteFooter'
import { openShare } from '../components/ShareMore'
import { useLedgerStore } from '../lib/store'
import { useIsPc } from '../lib/useIsPc'
import {
  SHARE_CATEGORIES,
  isNewShare,
  shareDate,
  sharesByDate,
  type ShareCategory,
  type ShareItem,
} from '../lib/shares'
import { shareItem, useShareViews, viewsLabel } from '../lib/shareViews'

type Views = Record<string, number>

/**
 * 결영이네 자료 나눔 (2026-10-24) — 로그인 없이 열리는 공개 목록. 단톡방 공지에 이 링크 하나만 걸어 둔다.
 * 생김새는 토스피드를 따랐다. 폰과 PC를 따로 짠다:
 * - 폰: 가운데 제목 → 번호 붙은 '새로 올라온 자료' → 분류 칩 → 큰 카드 한 줄씩
 * - PC: 왼쪽 큰 대표 자료 + 오른쪽 번호 목록 → 분류 칩 → 카드 세 칸
 */
export default function Share() {
  const navigate = useNavigate()
  const isPc = useIsPc()
  const inApp = useLedgerStore((st) => st.status === 'ready')
  const [cat, setCat] = useState<ShareCategory | null>(null)
  // 몇 명이 봤는지 (2026-11-21) — 많이 본 순으로도 볼 수 있게
  const views = useShareViews()
  const [popular, setPopular] = useState(false)
  const all = sharesByDate()
  const byCat = cat ? all.filter((s) => s.category === cat) : all
  const shown = popular
    ? [...byCat].sort((a, b) => (views[b.slug] ?? 0) - (views[a.slug] ?? 0))
    : byCat
  const open = (s: ShareItem) => openShare(navigate, s.path)

  const back = inApp && (
    <button
      onClick={() => navigate('/info')}
      className="-ml-1 flex items-center gap-0.5 text-[14px] font-semibold text-sub"
    >
      <ChevronLeft size={19} />돈 공부
    </button>
  )
  const chips = <Chips cat={cat} setCat={setCat} popular={popular} setPopular={setPopular} />
  const outro = (
    <>
      <OneTeamCard onStory={() => navigate('/story')} />
      {!inApp && (
        <a
          href="#/"
          className="mt-3 flex w-full items-center justify-center gap-0.5 py-3 text-[14px] font-bold text-brand"
        >
          모아불리 가계부 둘러보기
          <ChevronRight size={16} />
        </a>
      )}
    </>
  )

  if (isPc) {
    const [first, ...rest] = all
    return (
      <div className="min-h-screen bg-white break-keep">
        <div className="mx-auto max-w-[1080px] px-10 pb-16 pt-8">
          {back}
          <header className="pt-8">
            <h1 className="text-[34px] font-extrabold text-ink">결영이네 자료 나눔</h1>
            <p className="mt-2 text-[17px] text-sub">단톡방에서 나눈 자료, 여기 다 모아뒀어요</p>
          </header>

          {/* 대표 자료(가장 최근) + 새로 올라온 자료 번호 목록 */}
          <div className="mt-10 grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-10">
            {first && (
              <button onClick={() => open(first)} className="text-left active:opacity-80">
                <Cover
                  item={first}
                  className="aspect-[16/9] rounded-3xl"
                  emoji="text-[96px]"
                  share
                />
                <p className="mt-4 text-[24px] font-extrabold leading-snug text-ink">
                  {first.title}
                </p>
                <p className="mt-1.5 text-[16px] leading-relaxed text-sub">{first.sub}</p>
                <Meta item={first} views={views} />
              </button>
            )}
            <section aria-label="새로 올라온 자료">
              <h2 className="text-[20px] font-extrabold text-ink">새로 올라온 자료</h2>
              <ol className="mt-2">
                {rest.slice(0, 5).map((s, i) => (
                  <li key={s.slug} className="border-b border-line last:border-b-0">
                    <button
                      onClick={() => open(s)}
                      className="flex w-full items-center gap-4 py-4 text-left hover:opacity-70"
                    >
                      <span className="tnum w-4 shrink-0 text-[18px] font-bold text-brand">
                        {i + 2}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[16px] font-bold leading-snug text-ink">
                          {s.title}
                        </span>
                        <span className="mt-0.5 block text-[13px] text-cap">
                          {s.category} · {shareDate(s.date)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <section aria-label="전체 자료" className="mt-16">
            <div className="flex items-center justify-between">
              <h2 className="text-[22px] font-extrabold text-ink">전체 자료</h2>
              {chips}
            </div>
            <div className="mt-6 grid grid-cols-3 gap-x-6 gap-y-10">
              {shown.map((s) => (
                <button key={s.slug} onClick={() => open(s)} className="text-left hover:opacity-80">
                  <Cover item={s} className="aspect-[3/2] rounded-2xl" emoji="text-[56px]" share />
                  <p className="mt-3 text-[13px] text-cap">{s.category}</p>
                  <p className="mt-0.5 text-[18px] font-extrabold leading-snug text-ink">
                    {s.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[14.5px] leading-relaxed text-sub">
                    {s.sub}
                  </p>
                  <Meta item={s} views={views} />
                </button>
              ))}
            </div>
          </section>

          <div className="mx-auto mt-20 max-w-[560px]">{outro}</div>
        </div>
        <SiteFooter />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen justify-center bg-white break-keep">
      <div className="w-full max-w-app">
        <div className="px-5 pb-10 pt-6">
          {back}

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
            <div className="-mx-5 overflow-x-auto px-5 pb-1">{chips}</div>
            <div className="mt-6 space-y-9">
              {shown.map((s) => (
                <button key={s.slug} onClick={() => open(s)} className="block w-full text-left">
                  <Cover item={s} className="aspect-[16/9] rounded-2xl" emoji="text-[64px]" share />
                  <p className="mt-3 text-[18px] font-extrabold leading-snug text-ink">{s.title}</p>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-sub">{s.sub}</p>
                  <Meta item={s} views={views} />
                </button>
              ))}
            </div>
          </section>

          <div className="mt-12">{outro}</div>
        </div>
        <SiteFooter />
      </div>
    </div>
  )
}

function Chips({
  cat,
  setCat,
  popular,
  setPopular,
}: {
  cat: ShareCategory | null
  setCat: (c: ShareCategory | null) => void
  popular: boolean
  setPopular: (v: boolean) => void
}) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => setPopular(!popular)}
        aria-pressed={popular}
        className={`shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-bold transition-colors ${
          popular ? 'bg-brand text-white' : 'bg-brand/10 text-brand active:bg-brand/20'
        }`}
      >
        많이 본 순
      </button>
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
  )
}

/** 썸네일 자리 — 그림 파일이 생기기 전까지 그림 글자 + 바탕색. share면 오른쪽 위에 공유 버튼 */
function Cover({
  item,
  className,
  emoji,
  share = false,
}: {
  item: ShareItem
  className: string
  emoji: string
  share?: boolean
}) {
  return (
    <div className={`relative flex items-center justify-center ${item.tint} ${className}`}>
      {share && <ShareIcon item={item} />}
      <span className={emoji} aria-hidden>
        {item.emoji}
      </span>
      {isNewShare(item) && (
        <span className="absolute left-3 top-3 rounded bg-danger px-2 py-0.5 text-[11px] font-bold text-white">
          NEW
        </span>
      )}
    </div>
  )
}

function Meta({ item, views }: { item: ShareItem; views?: Views }) {
  const label = viewsLabel(views?.[item.slug])
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-1 text-[13px] text-cap">
      {label && (
        <span className="flex items-center gap-1 font-semibold text-sub">
          <Eye size={13} />
          {label}이 봤어요 ·
        </span>
      )}
      <Hourglass size={13} />
      {item.minutes}분 · {item.category} · {shareDate(item.date)}
    </p>
  )
}

/**
 * 카드 위 공유 버튼 — 카드 전체가 버튼이라 그 안에 버튼을 못 넣는다.
 * span(role=button)으로 두고 누르면 카드가 열리지 않게 막는다.
 */
function ShareIcon({ item }: { item: ShareItem }) {
  const [copied, setCopied] = useState(false)
  const go = async (e: React.SyntheticEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if ((await shareItem(item)) === 'copied') {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`${item.title} 공유하기`}
      onClick={(e) => void go(e)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && void go(e)}
      className="absolute right-3 top-3 flex h-9 items-center gap-1 rounded-full bg-white/90 px-2.5 text-[12px] font-bold text-ink shadow-card active:bg-white"
    >
      {copied ? <Check size={15} className="text-brand" /> : <Share2 size={15} />}
      {copied && '복사됨'}
    </span>
  )
}
