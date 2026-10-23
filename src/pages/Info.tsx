import SiteFooter from '../components/SiteFooter'
import PcColumns from '../components/PcColumns'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, PenLine } from 'lucide-react'
import Card from '../components/Card'
import EconomySection from '../components/EconomySection'
import { NOTICES, type Notice } from '../lib/notices'
import { amIAdmin, fetchNewsMeta, fetchPosts, type NewsMeta, type Post } from '../lib/posts'
import { markStartSeen } from '../lib/startGuide'
import OneTeamCard from '../components/OneTeamCard'
import { useIsPc } from '../lib/useIsPc'

/**
 * 돈 공부 탭 (2026-09-30 '정보'로 시작 — 게시판 + 자산 로드맵 자리를 합쳤다. 2026-10-06 이름을 '돈 공부'로).
 * 위에서부터: 계산기 → 오늘의 경제(결영이네 매일 글) → 원팀프로젝트 → 공지(새 기능 소식).
 *
 * 이야기(글쓰기·신고)는 누가 쓰고 누가 지우는지 정한 뒤에 연다.
 * 4,000명 단톡방이 그대로 들어오면 관리 없이는 못 버틴다.
 */
export default function Info() {
  const navigate = useNavigate()
  const isPc = useIsPc()
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [admin, setAdmin] = useState(false)
  const [meta, setMeta] = useState<Record<string, NewsMeta>>({})

  useEffect(() => {
    let live = true
    fetchPosts(12)
      .then((p) => live && setPosts(p))
      .catch(() => live && setPosts([])) // 못 읽으면 칸을 숨긴다 — 나머지 정보는 그대로 본다
    fetchNewsMeta()
      .then((m) => live && setMeta(m))
      .catch(() => {})
    amIAdmin()
      .then((a) => live && setAdmin(a))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  // 원팀프로젝트 (2026-10-23) — 준비 중이던 정보·혜택과 이야기 칸을 빼고 이 한 장으로
  const oneTeam = <OneTeamCard onStory={() => navigate('/story')} />

  return (
    <div className="animate-fade-up space-y-5">
      <header className="flex items-center justify-between px-1 pt-2">
        <h1 className="text-[18px] font-bold text-ink">돈 공부</h1>
        {admin && (
          <button
            onClick={() => navigate('/admin/posts')}
            className="flex items-center gap-1 rounded-full bg-brand/10 px-3 py-1.5 text-[12px] font-bold text-brand"
          >
            <PenLine size={13} /> 글 올리기
          </button>
        )}
      </header>

      {/* 계산기는 맨 위 (2026-10-23 결영이네 요청) — PC에선 한 줄로 */}
      <section aria-label="계산기" className="space-y-3">
        <SectionTitle>계산기</SectionTitle>
        {/* 돈 공부 계산기 (2026-10-07) — 우리집 가계부 숫자로 먼저 채워지고, 아래에서 결영이네로 이어진다 */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          {CALCS.map((c) => (
            <button
              key={c.title}
              onClick={() => {
                if (!c.to) return
                markStartSeen('calcs')
                navigate(c.to)
              }}
              disabled={!c.to}
              className="flex flex-col items-start gap-1 rounded-card bg-white p-3.5 text-left shadow-card disabled:opacity-60"
            >
              <span className="text-[20px]" aria-hidden>
                {c.icon}
              </span>
              <span className="text-[14px] font-bold text-ink">{c.title}</span>
              <span className="text-[12px] leading-snug text-sub">
                {c.to ? c.sub : '준비 중이에요'}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 폰에선 계산기 바로 아래 — 오늘의 경제 밑이면 한참 내려야 보였다 (2026-10-23) */}
      {!isPc && oneTeam}

      {/* PC에서는 두 칸 — 왼쪽(넓게): 오늘의 경제, 오른쪽: 원팀프로젝트·공지 (2026-10-06) */}
      <PcColumns
        wide="left"
        left={
          <>
            {/* 경제 뉴스는 기사 하나씩, 증시 정리는 최근 하루치 (2026-10-06) */}
            {posts && posts.length > 0 && <EconomySection posts={posts} meta={meta} />}
          </>
        }
        right={
          <>
            {isPc && oneTeam}

            {/* 공지는 맨 아래, 작게 (2026-10-21) */}
            <section aria-label="공지" className="space-y-2">
              <SectionTitle>공지</SectionTitle>
              {NOTICES.map((n) => (
                <NoticeCard key={n.id} notice={n} />
              ))}
            </section>
          </>
        }
      />
      <SiteFooter />
    </div>
  )
}

const CALCS: { icon: string; title: string; sub: string; to: string | null }[] = [
  { icon: '🍼', title: '육아휴직', sub: '쉬는 동안 한 달에 얼마', to: '/leave' },
  {
    icon: '🔑',
    title: '내집마련 대출 찾기',
    sub: '우리 조건에 유리한 대출',
    to: '/calc/home-loan',
  },
  { icon: '🏠', title: '집 살 때 드는 돈', sub: '집값 말고 잔금날 더', to: '/calc/home-cost' },
  { icon: '🌱', title: '노후 준비', sub: '지금 모으면 노후에 얼마', to: '/calc/retire' },
  { icon: '🏦', title: '대출 이자', sub: '매달 갚는 돈 · 총 이자', to: '/calc/loan' },
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="px-1 text-[13px] font-bold text-sub">{children}</p>
}

function NoticeCard({ notice }: { notice: Notice }) {
  const navigate = useNavigate()
  const [, m, d] = notice.date.split('-')
  const [open, setOpen] = useState(false)
  const points = notice.points ?? []
  const shown = open ? points : points.slice(0, 3)
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10.5px] font-bold text-brand">
          {notice.badge ?? '새로운 기능'}
        </span>
        <span className="text-[11.5px] text-cap">
          {Number(m)}월 {Number(d)}일
        </span>
      </div>
      <p className="mt-1.5 text-[14px] font-bold text-ink">{notice.title}</p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-sub">{notice.body}</p>
      {points.length > 0 && (
        <ul className="mt-2 space-y-1">
          {shown.map((pt) => (
            <li key={pt} className="flex gap-1.5 text-[12px] leading-relaxed text-sub">
              <span className="text-brand">·</span>
              <span>{pt}</span>
            </li>
          ))}
        </ul>
      )}
      {points.length > 3 && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-1.5 text-[12px] font-bold text-brand"
        >
          {open ? '접기' : `${points.length - 3}개 더 보기`}
        </button>
      )}
      {notice.link && (
        <button
          onClick={() => navigate(notice.link!.to)}
          className="mt-3 flex w-full items-center justify-between rounded-btn bg-brand px-3.5 py-2.5 text-white active:bg-brand-dark"
        >
          <span className="text-[13px] font-bold">{notice.link.label}</span>
          <ChevronRight size={17} className="shrink-0" />
        </button>
      )}
    </Card>
  )
}
