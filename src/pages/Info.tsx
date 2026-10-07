import SiteFooter from '../components/SiteFooter'
import PcColumns from '../components/PcColumns'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Gift, MessagesSquare, PenLine } from 'lucide-react'
import Card from '../components/Card'
import EconomySection from '../components/EconomySection'
import { NOTICES, type Notice } from '../lib/notices'
import { amIAdmin, fetchNewsMeta, fetchPosts, type NewsMeta, type Post } from '../lib/posts'

/**
 * 돈 공부 탭 (2026-09-30 '정보'로 시작 — 게시판 + 자산 로드맵 자리를 합쳤다. 2026-10-06 이름을 '돈 공부'로).
 * 위에서부터: 오늘의 경제(결영이네 매일 글) → 계산기 → 공지(새 기능 소식) → 정보·혜택(준비 중) → 이야기(준비 중).
 *
 * 이야기(글쓰기·신고)는 누가 쓰고 누가 지우는지 정한 뒤에 연다.
 * 4,000명 단톡방이 그대로 들어오면 관리 없이는 못 버틴다.
 */
export default function Info() {
  const navigate = useNavigate()
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

      {/* PC에서는 두 칸 — 왼쪽(넓게): 오늘의 경제, 오른쪽: 계산기·공지 (2026-10-06) */}
      <PcColumns
        wide="left"
        left={
          <>
            {/* 경제 뉴스는 기사 하나씩, 증시 정리는 최근 하루치 — 바로 아래 계산기가 밀려나지 않게 (2026-10-06) */}
            {posts && posts.length > 0 && <EconomySection posts={posts} meta={meta} />}
          </>
        }
        right={
          <>
            <section aria-label="계산기" className="space-y-3">
              <SectionTitle>계산기</SectionTitle>
              {/* 돈 공부 계산기 (2026-10-07) — 우리집 가계부 숫자로 먼저 채워지고, 아래에서 결영이네로 이어진다 */}
              <div className="grid grid-cols-2 gap-2">
                {CALCS.map((c) => (
                  <button
                    key={c.title}
                    onClick={() => c.to && navigate(c.to)}
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

            <section aria-label="공지" className="space-y-3">
              <SectionTitle>공지</SectionTitle>
              {NOTICES.map((n) => (
                <NoticeCard key={n.id} notice={n} />
              ))}
            </section>

            <section aria-label="정보·혜택" className="space-y-3">
              <SectionTitle>정보 · 혜택</SectionTitle>
              <Soon
                Icon={Gift}
                title="신혼부부 정책·혜택은 준비하고 있어요"
                text="우리집이 받을 수 있는 지원금과 제휴 할인을 모아 둘게요."
              />
            </section>

            <section aria-label="이야기" className="space-y-3">
              <SectionTitle>이야기</SectionTitle>
              <Soon
                Icon={MessagesSquare}
                title="이야기 나누는 곳은 준비하고 있어요"
                text="다른 집은 어떻게 모으고 있는지 여기서 볼 수 있게 만들고 있어요."
              />
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
  { icon: '🏠', title: '집 살 때 드는 돈', sub: '집값 말고 잔금날 더', to: null },
  { icon: '🌱', title: '노후 준비', sub: '지금 모으면 노후에 얼마', to: '/calc/retire' },
  { icon: '🏦', title: '대출 이자', sub: '매달 갚는 돈 · 총 이자', to: '/calc/loan' },
]

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="px-1 text-[13px] font-bold text-sub">{children}</p>
}

function Soon({ Icon, title, text }: { Icon: typeof Gift; title: string; text: string }) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg">
          <Icon size={20} className="text-cap" />
        </div>
        <div>
          <p className="text-[14px] font-bold text-ink">{title}</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-sub">{text}</p>
        </div>
      </div>
    </Card>
  )
}

function NoticeCard({ notice }: { notice: Notice }) {
  const navigate = useNavigate()
  const [, m, d] = notice.date.split('-')
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
          새로운 기능
        </span>
        <span className="text-[12px] text-cap">
          {Number(m)}월 {Number(d)}일
        </span>
      </div>
      <p className="mt-2 text-[16px] font-bold text-ink">{notice.title}</p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-sub">{notice.body}</p>
      {notice.points && (
        <ul className="mt-2.5 space-y-1.5">
          {notice.points.map((pt) => (
            <li key={pt} className="flex gap-2 text-[13.5px] leading-relaxed text-sub">
              <span className="text-brand">·</span>
              <span>{pt}</span>
            </li>
          ))}
        </ul>
      )}
      {notice.link && (
        <button
          onClick={() => navigate(notice.link!.to)}
          className="mt-4 flex w-full items-center justify-between rounded-btn bg-brand px-3.5 py-3 text-white active:bg-brand-dark"
        >
          <span className="text-[14px] font-bold">{notice.link.label}</span>
          <ChevronRight size={17} className="shrink-0" />
        </button>
      )}
    </Card>
  )
}
