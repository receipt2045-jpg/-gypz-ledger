import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ArticleHero, ArticleRow, FeedTabs, SectionChips } from './NewsCards'
import {
  fetchNewsMeta,
  fetchPosts,
  groupByDay,
  groupByMonth,
  parseArticles,
  postSummary,
  type DayGroup,
  type NewsMeta,
  type Post,
} from '../lib/posts'

/** 증시 정리 — 펼친 달에서 처음 보이는 날 수 */
const FIRST_DAYS = 3
/** 경제 뉴스 — 처음 보이는 날 수, 더 보기 한 번에 늘어나는 날 수 */
const NEWS_DAYS = 5
const NEWS_DAYS_MORE = 7

/**
 * '오늘의 경제' 지난 글 (2026-10-06).
 * 경제 뉴스 — 기사 하나씩, 날짜별(그날 큰 카드 1 + 나머지 줄). 증시 정리 — 달별로 묶고 날짜별.
 * 공개 화면(/news)과 앱 정보 탭(/info/archive)이 같이 쓴다. 탭은 주소(?tab=market)에 남긴다.
 */
export default function NewsArchive({ basePath }: { basePath: '/news' | '/info' }) {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'market' ? 'market' : 'news'
  const [posts, setPosts] = useState<Post[] | null>(null)
  const [meta, setMeta] = useState<Record<string, NewsMeta>>({})

  useEffect(() => {
    let live = true
    fetchPosts(1000)
      .then((p) => live && setPosts(p))
      .catch(() => live && setPosts([]))
    fetchNewsMeta()
      .then((m) => live && setMeta(m))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

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

  const news = posts.filter((p) => p.kind === 'news')
  const market = posts.filter((p) => p.kind === 'market')

  return (
    <div className="space-y-3">
      <FeedTabs value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} />
      {tab === 'news' ? (
        <NewsTimeline posts={news} meta={meta} basePath={basePath} />
      ) : (
        <MarketMonths posts={market} basePath={basePath} />
      )}
    </div>
  )
}

/** 경제 뉴스 — 날짜마다 큰 카드(그날의 픽) + 나머지 기사 줄 */
function NewsTimeline({
  posts,
  meta,
  basePath,
}: {
  posts: Post[]
  meta: Record<string, NewsMeta>
  basePath: string
}) {
  const [section, setSection] = useState('all')
  const [days, setDays] = useState(NEWS_DAYS)

  const byPost = useMemo(
    () =>
      [...posts]
        .sort((a, b) => (a.postDate < b.postDate ? 1 : -1))
        .map((p) => ({ post: p, articles: parseArticles(p) }))
        .filter((x) => x.articles.length > 0),
    [posts],
  )
  const all = byPost.flatMap((x) => x.articles)
  if (all.length === 0) {
    return <p className="px-1 text-[14px] text-sub">아직 올라온 경제 뉴스가 없어요.</p>
  }

  const visible = byPost.slice(0, days)
  return (
    <div className="space-y-3">
      <p className="px-1 text-[13px] text-sub">지금까지 기사 {all.length}개를 모아 뒀어요</p>
      <SectionChips articles={all} value={section} onChange={setSection} />
      {visible.map(({ post, articles }, i) => {
        const shown = articles.filter((a) => section === 'all' || a.section === section)
        if (shown.length === 0) return null
        const hero = shown.find((a) => a.pick) ?? shown[0]
        const rest = shown.filter((a) => a !== hero)
        const [y, m] = post.postDate.split('-').map(Number)
        const newMonth = i === 0 || visible[i - 1].post.postDate.slice(0, 7) !== post.postDate.slice(0, 7)
        return (
          <Fragment key={post.id}>
            {newMonth && (
              <p className="px-1 pt-2 text-[16px] font-bold text-ink">
                {y}년 {m}월
              </p>
            )}
            <p className="px-1 text-[13px] font-bold text-sub">{groupByDay([post])[0].label}</p>
            <ArticleHero
              article={hero}
              meta={meta[hero.url]}
              comment={hero.pick ? postSummary(post.body) : undefined}
              postLink={`${basePath}/${post.id}`}
            />
            {rest.length > 0 && (
              <div className="overflow-hidden rounded-card bg-white shadow-card">
                {rest.map((a) => (
                  <ArticleRow key={a.id} article={a} meta={meta[a.url]} />
                ))}
              </div>
            )}
          </Fragment>
        )
      })}
      {days < byPost.length && (
        <button
          onClick={() => setDays((d) => d + NEWS_DAYS_MORE)}
          className="w-full rounded-btn bg-white py-3 text-[13.5px] font-bold text-sub shadow-card"
        >
          지난 뉴스 더 보기
        </button>
      )}
    </div>
  )
}

/** 증시 정리 — 달별로 묶고 맨 위 달만 펼친다. 달 안에서는 날짜별 */
function MarketMonths({ posts, basePath }: { posts: Post[]; basePath: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const months = useMemo(
    () => groupByMonth(posts).map((g) => ({ ...g, days: groupByDay(g.posts) })),
    [posts],
  )
  if (months.length === 0) {
    return <p className="px-1 text-[14px] text-sub">아직 올라온 증시 정리가 없어요.</p>
  }
  const isOpen = (ym: string, i: number) => open[ym] ?? i === 0

  return (
    <div className="space-y-2.5">
      <p className="px-1 text-[13px] text-sub">지금까지 증시 정리 {posts.length}개를 모아 뒀어요</p>
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
