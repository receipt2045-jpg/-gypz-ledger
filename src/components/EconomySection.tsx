import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { DayCard } from './NewsArchive'
import { ArticleHero, ArticleRow, FeedTabs, SectionChips } from './NewsCards'
import { groupByDay, parseArticles, postSummary, type NewsMeta, type Post } from '../lib/posts'

/** 큰 카드 아래로 처음 보이는 기사 수 */
const FIRST_ROWS = 3

/**
 * 정보 탭 '오늘의 경제' (2026-10-06).
 * 경제 뉴스 — 가장 최근 글의 기사를 하나씩(큰 카드 1 + 줄), 증시 정리 — 가장 최근 하루치.
 * 지난 글은 /info/archive 에서.
 */
export default function EconomySection({
  posts,
  meta,
}: {
  posts: Post[]
  meta: Record<string, NewsMeta>
}) {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'news' | 'market'>('news')
  const [section, setSection] = useState('all')
  const [more, setMore] = useState(false)

  const latestNews = posts.find((p) => p.kind === 'news')
  const articles = useMemo(() => (latestNews ? parseArticles(latestNews) : []), [latestNews])
  const latestMarket = useMemo(() => groupByDay(posts.filter((p) => p.kind === 'market'))[0], [posts])

  const shown = articles.filter((a) => section === 'all' || a.section === section)
  const hero = shown.find((a) => a.pick) ?? shown[0]
  const rest = shown.filter((a) => a !== hero)
  const rows = more ? rest : rest.slice(0, FIRST_ROWS)

  const archiveButton = (label: string, to: string) => (
    <button
      onClick={() => navigate(to)}
      className="flex w-full items-center justify-between border-t border-bg px-4 py-3 text-[13.5px] font-bold text-sub"
    >
      {label}
      <ChevronRight size={15} className="text-cap" />
    </button>
  )

  return (
    <section aria-label="오늘의 경제" className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="border-l-4 border-brand pl-2 text-[16px] font-bold leading-none text-ink">
          오늘의 경제
        </h2>
        <button
          onClick={() => navigate(`/info/archive?tab=${tab}`)}
          className="flex items-center text-[12.5px] text-sub"
        >
          전체보기 <ChevronRight size={14} />
        </button>
      </div>
      <FeedTabs value={tab} onChange={setTab} />

      {tab === 'news' && latestNews && hero && (
        <>
          {articles.length > 1 && (
            <SectionChips
              articles={articles}
              value={section}
              onChange={(v) => {
                setSection(v)
                setMore(false)
              }}
            />
          )}
          <ArticleHero
            article={hero}
            meta={meta[hero.url]}
            comment={hero.pick ? postSummary(latestNews.body) : undefined}
            postLink={`/info/${latestNews.id}`}
          />
          {rest.length > 0 && (
            <div className="overflow-hidden rounded-card bg-white shadow-card">
              {rows.map((a) => (
                <ArticleRow key={a.id} article={a} meta={meta[a.url]} />
              ))}
              {!more && rest.length > FIRST_ROWS ? (
                <button
                  onClick={() => setMore(true)}
                  className="w-full border-t border-bg py-3 text-[13.5px] font-bold text-sub"
                >
                  뉴스 {rest.length - FIRST_ROWS}개 더 보기
                </button>
              ) : (
                archiveButton('지난 경제 뉴스 보기', '/info/archive?tab=news')
              )}
            </div>
          )}
        </>
      )}

      {tab === 'news' && !latestNews && (
        <p className="rounded-card bg-white p-4 text-[14px] text-sub shadow-card">
          아직 올라온 경제 뉴스가 없어요.
        </p>
      )}

      {tab === 'market' &&
        (latestMarket ? (
          <DayCard
            day={latestMarket}
            basePath="/info"
            footer={archiveButton('지난 증시 정리 보기', '/info/archive?tab=market')}
          />
        ) : (
          <p className="rounded-card bg-white p-4 text-[14px] text-sub shadow-card">
            아직 올라온 증시 정리가 없어요.
          </p>
        ))}
    </section>
  )
}
