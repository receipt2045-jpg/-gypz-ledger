import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Link2 } from 'lucide-react'
import OneTeamCard from './OneTeamCard'
import ShareMore, { openShare } from './ShareMore'
import SiteFooter from './SiteFooter'
import { useLedgerStore } from '../lib/store'

/**
 * 자료 나눔 글 한 편의 틀 (2026-10-27) — 금테크·증여 신고·지원금 계산기가 같이 쓴다.
 * 폰: 가운데 한 줄(전과 같음).
 * PC(lg): 1080px로 넓히고 표지는 제목·설명을 양옆에, 본문은 두 칸.
 * - 글(kind='guide'): 왼쪽 본문 + 오른쪽 따라오는 목차·링크 복사
 * - 계산기(kind='calc'): 왼쪽 따라오는 입력 + 오른쪽 결과·설명. 폰에선 입력이 먼저라 순서가 같다
 * 맨 끝(다른 자료 → 원팀프로젝트 → 자료 출처)은 넓게 한 줄.
 */
export default function ShareArticle({
  kind,
  hero,
  side,
  toc,
  children,
  sources,
}: {
  kind: 'guide' | 'calc'
  hero: ReactNode
  /** calc: 입력 칸(왼쪽, 따라옴). guide에선 안 쓴다 */
  side?: ReactNode
  /** guide: 오른쪽 목차 — 각 섹션은 ShareSection(no)로 id가 붙는다 */
  toc?: { no: number; title: string }[]
  children: ReactNode
  sources: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen justify-center bg-bg break-keep">
      <div className="w-full max-w-app lg:max-w-[1080px]">
        <div className="space-y-4 px-4 pb-10 pt-6 lg:space-y-6 lg:px-10 lg:pb-16 lg:pt-8">
          <TopBar />
          {hero}

          {kind === 'calc' ? (
            <div className="space-y-4 lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
              <div className="lg:sticky lg:top-6">{side}</div>
              <div className="min-w-0 space-y-4 lg:space-y-6">{children}</div>
            </div>
          ) : (
            <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:gap-8 lg:space-y-0">
              <div className="min-w-0 space-y-4 lg:space-y-6">{children}</div>
              {toc && <Toc toc={toc} />}
            </div>
          )}

          <div className="lg:pt-6">
            <ShareMore wide />
          </div>
          <OneTeamCard onStory={() => navigate('/story')} />
          <div className="px-1 pt-2 text-[12px] leading-relaxed text-cap lg:max-w-[760px]">
            {sources}
          </div>
        </div>
        <SiteFooter />
      </div>
    </div>
  )
}

/** 검은 표지 — PC에선 제목 왼쪽, 설명 오른쪽 */
export function ShareHero({
  kicker,
  title,
  lead,
}: {
  kicker: string
  title: ReactNode
  lead: ReactNode
}) {
  return (
    <section className="rounded-card bg-ink px-6 py-9 text-white lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end lg:gap-12 lg:rounded-3xl lg:px-14 lg:py-16">
      <div>
        <p className="text-[13px] font-bold text-white/60 lg:text-[15px]">{kicker}</p>
        <h1 className="mt-3 text-[30px] font-extrabold leading-[1.35] lg:text-[42px] lg:leading-[1.3]">
          {title}
        </h1>
      </div>
      <p className="mt-4 text-[16px] leading-relaxed text-white/80 lg:mt-0 lg:text-[18px]">
        {lead}
      </p>
    </section>
  )
}

/** 번호 붙은 흰 카드. PC 목차에서 #share-sec-N으로 찾아온다 */
export function ShareSection({
  no,
  title,
  children,
}: {
  no: number
  title: string
  children: ReactNode
}) {
  return (
    <section
      id={`share-sec-${no}`}
      className="scroll-mt-6 rounded-card bg-card px-5 py-6 shadow-card lg:px-8 lg:py-8"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-[15px] font-extrabold text-white">
          {no}
        </span>
        <h2 className="text-[21px] font-extrabold leading-snug text-ink lg:text-[23px]">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

/** 위 줄 — 앱 안에서 왔으면 '가계부로 돌아가기', PC는 오른쪽에 자료 나눔 전체 보기 */
function TopBar() {
  const navigate = useNavigate()
  const inApp = useLedgerStore((st) => st.status === 'ready')
  return (
    <div className="flex items-center justify-between">
      {inApp ? (
        <button
          onClick={() => window.history.back()}
          className="-ml-1 flex items-center gap-0.5 text-[14px] font-semibold text-sub"
        >
          <ChevronLeft size={19} />
          가계부로 돌아가기
        </button>
      ) : (
        <span />
      )}
      <button
        onClick={() => openShare(navigate, '/share')}
        className="hidden items-center gap-0.5 text-[14px] font-semibold text-sub hover:text-ink lg:flex"
      >
        결영이네 자료 나눔
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

/** PC 오른쪽 — 따라오는 목차 + 링크 복사 */
function Toc({ toc }: { toc: { no: number; title: string }[] }) {
  const { pathname } = useLocation()
  const [copied, setCopied] = useState(false)
  const copy = () => {
    const url = `https://moabuli.com/#${pathname.replace(/\/+$/, '')}`
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => undefined)
  }
  return (
    <aside aria-label="목차" className="hidden lg:sticky lg:top-6 lg:block">
      <div className="rounded-card bg-card px-5 py-5 shadow-card">
        <p className="text-[13px] font-bold text-cap">이 글 목차</p>
        <ol className="mt-3 space-y-1">
          {toc.map((t) => (
            <li key={t.no}>
              <button
                onClick={() =>
                  document
                    .getElementById(`share-sec-${t.no}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                className="flex w-full gap-2 rounded-lg px-2 py-1.5 text-left text-[14px] leading-snug text-sub hover:bg-bg hover:text-ink"
              >
                <span className="tnum shrink-0 font-bold text-brand">{t.no}</span>
                {t.title}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <button
        onClick={copy}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-btn bg-card py-3 text-[14px] font-bold text-ink shadow-card hover:bg-line"
      >
        {copied ? <Check size={16} className="text-brand" /> : <Link2 size={16} />}
        {copied ? '링크를 복사했어요' : '이 자료 링크 복사'}
      </button>
    </aside>
  )
}
