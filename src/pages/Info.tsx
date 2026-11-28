import SiteFooter from '../components/SiteFooter'
import PcColumns from '../components/PcColumns'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, PenLine } from 'lucide-react'
import EconomySection from '../components/EconomySection'
import { amIAdmin, fetchNewsMeta, fetchPosts, type NewsMeta, type Post } from '../lib/posts'
import { markStartSeen } from '../lib/startGuide'
import ShareList from '../components/ShareList'
import { useIsPc } from '../lib/useIsPc'

/**
 * 돈 공부 탭 (2026-09-30 '정보'로 시작 — 게시판 + 자산 로드맵 자리를 합쳤다. 2026-10-06 이름을 '돈 공부'로).
 *
 * 2026-11-21 배치 다시(결영 요청): 자료가 많아져 자료 나눔을 맨 위로.
 *   폰: 자료 나눔(분류 칩·새 자료 5개) → 오늘의 경제 → 계산기(옆으로 넘기는 한 줄) → 원팀프로젝트(작은 띠)
 *   PC: 왼쪽 넓게 자료 나눔·오늘의 경제 / 오른쪽 계산기(세로 목록)·원팀프로젝트
 *   공지 칸은 뺐다 — 남은 공지가 9월 육아휴직 계산기 하나뿐이었다. 새 소식은 앱 알림으로.
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

  const goCalc = (to: string | null) => {
    if (!to) return
    markStartSeen('calcs')
    navigate(to)
  }

  // 계산기 — 폰: 옆으로 넘기는 한 줄 / PC: 오른쪽 세로 목록
  const calcs = (
    <section aria-label="계산기" className="space-y-2">
      <SectionTitle>계산기</SectionTitle>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {CALCS.map((c) => (
          <button
            key={c.title}
            onClick={() => goCalc(c.to)}
            disabled={!c.to}
            className="flex w-[148px] shrink-0 flex-col items-start gap-0.5 rounded-card bg-white p-3 text-left shadow-card active:bg-bg disabled:opacity-60 lg:w-full lg:flex-row lg:items-center lg:gap-3"
          >
            <span className="text-[18px]" aria-hidden>
              {c.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-bold text-ink">{c.title}</span>
              <span className="block text-[11.5px] leading-snug text-sub">
                {c.to ? c.sub : '준비 중이에요'}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )

  // 원팀프로젝트 — 큰 카드 대신 작은 띠 한 줄, 누르면 5기 부부 이야기
  const oneTeam = (
    <button
      onClick={() => navigate('/story')}
      className="flex w-full items-center gap-3 rounded-card bg-ink px-4 py-3.5 text-left text-white active:opacity-90"
    >
      <span className="text-[20px]" aria-hidden>
        🤝
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-bold">원팀프로젝트</span>
        <span className="block text-[12px] text-white/65">
          같은 고민을 하는 부부들과 함께 공부해요
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-white/60" />
    </button>
  )

  const economy = posts && posts.length > 0 && <EconomySection posts={posts} meta={meta} />

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

      {isPc ? (
        <PcColumns
          wide="left"
          left={
            <>
              <ShareList count={5} />
              {economy}
            </>
          }
          right={
            <>
              {calcs}
              {oneTeam}
            </>
          }
        />
      ) : (
        <>
          <ShareList count={5} />
          {economy}
          {calcs}
          {oneTeam}
        </>
      )}
      <SiteFooter />
    </div>
  )
}

const CALCS: { icon: string; title: string; sub: string; to: string | null }[] = [
  { icon: '🍼', title: '육아휴직', sub: '휴직 중 월 수령액', to: '/leave' },
  {
    icon: '🔑',
    title: '내집마련 대출 찾기',
    sub: '조건에 맞는 대출 비교',
    to: '/calc/home-loan',
  },
  { icon: '🏠', title: '집 살 때 드는 돈', sub: '잔금날 부대비용', to: '/calc/home-cost' },
  { icon: '🌱', title: '노후 준비', sub: '노후 자금 계산', to: '/calc/retire' },
  { icon: '🏦', title: '대출 이자', sub: '매달 갚는 돈 · 총 이자', to: '/calc/loan' },
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="px-1 text-[13px] font-bold text-sub">{children}</p>
}
