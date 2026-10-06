import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { fetchPosts, groupByMonth, postSummary, type Post, type PostKind } from '../lib/posts'

/** 펼친 달에서 처음 보이는 글 수 — 나머지는 'N월 글 더 보기' */
const FIRST_ROWS = 3
const WEEKDAY = '일월화수목금토'

type Filter = 'all' | Exclude<PostKind, 'notice'>
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'news', label: '경제 뉴스' },
  { key: 'market', label: '증시 정리' },
]

/**
 * '오늘의 경제' 지난 글 모아 보기 (2026-10-06).
 * 달별로 묶고 맨 위 달만 펼친다. 한 줄은 날짜·제목·🔰 한 줄 정리 — 누르면 전체 글.
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

  const groups = useMemo(
    () => groupByMonth((posts ?? []).filter((p) => filter === 'all' || p.kind === filter)),
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
    <div className="space-y-2">
      <p className="px-1 text-[13px] text-sub">지금까지 {posts.length}개 글을 모아 뒀어요</p>
      <div className="flex gap-1.5 px-0.5 pb-1 pt-1" role="group" aria-label="글 종류">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${
              filter === f.key
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-white text-sub'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {groups.map((g, i) => {
        const opened = isOpen(g.ym, i)
        const rows = opened && !expanded[g.ym] ? g.posts.slice(0, FIRST_ROWS) : g.posts
        const rest = g.posts.length - FIRST_ROWS
        return (
          <section key={g.ym} className="overflow-hidden rounded-card bg-white shadow-card">
            <button
              onClick={() => setOpen((o) => ({ ...o, [g.ym]: !opened }))}
              aria-expanded={opened}
              className="flex w-full items-center justify-between px-4 py-3.5 text-left"
            >
              <span className="text-[15px] font-bold text-ink">{g.label}</span>
              <span className="flex items-center gap-0.5 text-[12.5px] text-cap">
                {g.posts.length}개
                {opened ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </span>
            </button>
            {opened && (
              <>
                {rows.map((p) => (
                  <ArchiveRow key={p.id} post={p} basePath={basePath} />
                ))}
                {!expanded[g.ym] && rest > 0 && (
                  <button
                    onClick={() => setExpanded((e) => ({ ...e, [g.ym]: true }))}
                    className="w-full border-t border-bg py-3 text-[13px] font-bold text-sub"
                  >
                    {g.label.split(' ')[1]} 글 {rest}개 더 보기
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

function ArchiveRow({ post, basePath }: { post: Post; basePath: string }) {
  const navigate = useNavigate()
  const [y, m, d] = post.postDate.split('-').map(Number)
  const weekday = WEEKDAY[new Date(y, m - 1, d).getDay()]
  return (
    <button
      onClick={() => navigate(`${basePath}/${post.id}`)}
      className="flex w-full gap-3 border-t border-bg px-4 py-3 text-left"
    >
      <span className="w-8 flex-none pt-0.5 text-center text-[11.5px] leading-tight text-cap">
        <b className="block text-[16px] font-bold text-ink">{d}</b>
        {weekday}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`inline-block rounded-md px-1.5 py-px text-[11px] font-bold ${
            post.kind === 'market' ? 'bg-[#E6F7EF] text-[#12A56B]' : 'bg-brand/10 text-brand'
          }`}
        >
          {post.title}
        </span>
        <span className="mt-1 line-clamp-2 block text-[14px] leading-snug text-[#333D4B]">
          {postSummary(post.body)}
        </span>
      </span>
    </button>
  )
}
