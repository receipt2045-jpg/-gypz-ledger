import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import {
  fetchPosts,
  groupByDay,
  groupByMonth,
  postSummary,
  type DayGroup,
  type PostKind,
  type Post,
} from '../lib/posts'

/** 펼친 달에서 처음 보이는 날 수 — 나머지는 'N월 글 더 보기' */
const FIRST_DAYS = 3

type Filter = 'all' | Exclude<PostKind, 'notice'>
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'news', label: '경제 뉴스' },
  { key: 'market', label: '증시 정리' },
]

/**
 * '오늘의 경제' 지난 글 모아 보기 (2026-10-06).
 * 달별로 묶고 맨 위 달만 펼친다. 달 안에서는 날짜별로 — 같은 날 글은 한 묶음.
 * 공개 화면(/news)과 앱 정보 탭(/info/archive)이 같이 쓴다.
 */
export default function NewsArchive({ basePath }: { basePath: '/news' | '/info' }) {
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let live = true
    fetchPosts(1000)
      .then((p) => live && setPosts(p))
      .catch(() => live && setPosts([]))
    return () => {
      live = false
    }
  }, [])

  const months = useMemo(
    () =>
      groupByMonth((posts ?? []).filter((p) => filter === 'all' || p.kind === filter)).map(
        (g) => ({ ...g, days: groupByDay(g.posts) }),
      ),
    [posts, filter],
  )

  if (posts === null) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-brand" />
      </div>
    )
  }
  if (posts.length === 0) {
    return (
      <div className="rounded-card bg-white p-5 text-[14px] text-sub shadow-card">
        아직 올라온 글이 없어요.
      </div>
    )
  }

  // 처음엔 맨 위 달만 펼친다
  const isOpen = (ym: string, i: number) => open[ym] ?? i === 0

  return (
    <div className="space-y-2.5">
      <p className="px-1 text-[13px] text-sub">지금까지 {posts.length}개 글을 모아 뒀어요</p>
      <div className="flex gap-1.5 px-0.5 pb-1" role="group" aria-label="글 종류">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${
              filter === f.key ? 'border-ink bg-ink text-white' : 'border-line bg-white text-sub'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {months.map((g, i) => {
        const opened = isOpen(g.ym, i)
        const days = expanded[g.ym] ? g.days : g.days.slice(0, FIRST_DAYS)
        const hidden = g.days.length - days.length
        return (
          <section key={g.ym} className="space-y-2.5">
            <button
              onClick={() => setOpen((o) => ({ ...o, [g.ym]: !opened }))}
              aria-expanded={opened}
              className={`flex w-full items-center justify-between rounded-card px-4 py-3.5 text-left ${
                opened ? '' : 'bg-white shadow-card'
              }`}
            >
              <span className="text-[16px] font-bold text-ink">{g.label}</span>
              <span className="flex items-center gap-0.5 text-[12.5px] text-cap">
                {g.posts.length}개
                {opened ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </span>
            </button>
            {opened && (
              <>
                {days.map((d) => (
                  <DayCard key={d.date} day={d} basePath={basePath} />
                ))}
                {hidden > 0 && (
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [g.ym]: true }))}
                    className="w-full py-2 text-[13.5px] font-bold text-sub"
                  >
                    {g.label.split(' ')[1]} 글 더 보기
                  </button>
                )}
              </>
            )}
          </section>
        )
      })}
    </div>
  )
}

/** 하루치 글 — 날짜 머리 아래에 그날 올린 글을 순서대로 */
export function DayCard({
  day,
  basePath,
  footer,
}: {
  day: DayGroup
  basePath: string
  footer?: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-card bg-white shadow-card">
      <p className="px-4 pb-0.5 pt-3.5 text-[13px] font-bold text-sub">{day.label}</p>
      {day.posts.map((p) => (
        <DayRow key={p.id} post={p} basePath={basePath} />
      ))}
      {footer}
    </div>
  )
}

function DayRow({ post, basePath }: { post: Post; basePath: string }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`${basePath}/${post.id}`)}
      className="block w-full border-t border-bg px-4 py-3 text-left first-of-type:border-t-0"
    >
      <span
        className={`block text-[12px] font-bold ${
          post.kind === 'market' ? 'text-[#12A56B]' : 'text-brand'
        }`}
      >
        {post.title}
      </span>
      <span className="mt-1 line-clamp-3 block text-[15px] leading-normal text-ink">
        {postSummary(post.body)}
      </span>
    </button>
  )
}
