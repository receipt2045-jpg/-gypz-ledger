import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { sizedImage, type Article, type NewsMeta } from '../lib/posts'

/**
 * 경제 뉴스 기사 카드 (2026-10-06, 재개발뷰 '뉴스/소식' 참고).
 * 누르면 원래 기사(네이버 뉴스)로 간다. 사진·언론사는 news_meta 표에서 — 없으면 글자만.
 */

const SECTION_STYLE: Record<string, string> = {
  주식: 'bg-[#FFF0F0] text-[#E5484D]',
  부동산: 'bg-brand/10 text-brand',
}

export function SectionTag({ section }: { section: string }) {
  return (
    <span
      className={`inline-block rounded-md px-1.5 py-px text-[11px] font-bold ${
        SECTION_STYLE[section] ?? 'bg-bg text-sub'
      }`}
    >
      {section}
    </span>
  )
}

function dateLabel(postDate: string) {
  const [, m, d] = postDate.split('-').map(Number)
  return `${m}월 ${d}일`
}

function Source({ article, meta }: { article: Article; meta?: NewsMeta }) {
  return (
    <span className="mt-1.5 block text-[11.5px] text-cap">
      {meta?.press ? `${meta.press} · ` : ''}
      {dateLabel(article.postDate)}
    </span>
  )
}

/** 큰 카드 — 그날 '딱 하나만 읽는다면' 기사. comment는 결영이네 한 줄 정리 */
export function ArticleHero({
  article,
  meta,
  comment,
  postLink,
}: {
  article: Article
  meta?: NewsMeta
  comment?: string
  /** 결영이네 정리 전체(그날 글)로 가는 주소 */
  postLink?: string
}) {
  return (
    <div className="overflow-hidden rounded-card bg-white shadow-card">
      <a href={article.url} target="_blank" rel="noopener noreferrer" className="block">
        {meta?.image && (
          <div className="relative aspect-[16/9] bg-line">
            <img
              src={sizedImage(meta.image, 647)}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            {article.pick && (
              <span className="absolute left-3 top-3 rounded-full bg-ink/85 px-2.5 py-1 text-[11px] font-bold text-white">
                오늘 딱 하나만 읽는다면
              </span>
            )}
          </div>
        )}
        <div className="px-4 pb-3 pt-3.5">
          {article.pick && !meta?.image && (
            <span className="mb-1.5 block text-[11.5px] font-bold text-brand">
              오늘 딱 하나만 읽는다면
            </span>
          )}
          <SectionTag section={article.section} />
          <span className="mt-1.5 block text-[16.5px] font-bold leading-snug text-ink">
            {article.headline}
          </span>
          {comment ? (
            <span className="mt-1.5 block text-[13.5px] leading-relaxed text-sub">{comment}</span>
          ) : (
            article.note && (
              <span className="mt-1 block text-[13px] text-sub">→ {article.note}</span>
            )
          )}
          <Source article={article} meta={meta} />
        </div>
      </a>
      {postLink && (
        <Link
          to={postLink}
          className="flex items-center justify-between border-t border-bg px-4 py-2.5 text-[12.5px] font-bold text-sub"
        >
          결영이네 정리 전체 보기
          <ChevronRight size={15} className="text-cap" />
        </Link>
      )}
    </div>
  )
}

/** 작은 줄 — 왼쪽 글, 오른쪽 사진 */
export function ArticleRow({ article, meta }: { article: Article; meta?: NewsMeta }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 border-t border-bg px-4 py-3 first:border-t-0"
    >
      <span className="min-w-0 flex-1">
        <SectionTag section={article.section} />
        <span className="mt-1 line-clamp-2 block text-[14.5px] font-bold leading-snug text-ink">
          {article.headline}
        </span>
        {article.note && (
          <span className="mt-0.5 line-clamp-1 block text-[12.5px] text-sub">
            → {article.note}
          </span>
        )}
        <Source article={article} meta={meta} />
      </span>
      {meta?.image && (
        <img
          src={sizedImage(meta.image, 300)}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-[72px] w-[72px] flex-none rounded-lg bg-line object-cover"
        />
      )}
    </a>
  )
}

/** 전체 · 주식 · 부동산 거르기 칸 (숫자 포함) */
export function SectionChips({
  articles,
  value,
  onChange,
}: {
  articles: Article[]
  value: string
  onChange: (v: string) => void
}) {
  const sections = [...new Set(articles.map((a) => a.section))]
  const chips = [
    { key: 'all', label: '전체', n: articles.length },
    ...sections.map((s) => ({ key: s, label: s, n: articles.filter((a) => a.section === s).length })),
  ]
  return (
    <div className="flex gap-1.5" role="group" aria-label="기사 분야">
      {chips.map((c) => (
        <button
          key={c.key}
          onClick={() => onChange(c.key)}
          aria-pressed={value === c.key}
          className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold ${
            value === c.key ? 'border-brand bg-brand text-white' : 'border-line bg-white text-sub'
          }`}
        >
          {c.label} <span className="font-normal opacity-80">{c.n}</span>
        </button>
      ))}
    </div>
  )
}

/** 경제 뉴스 / 증시 정리 위쪽 탭 */
export function FeedTabs({
  value,
  onChange,
}: {
  value: 'news' | 'market'
  onChange: (v: 'news' | 'market') => void
}) {
  const tabs = [
    { key: 'news' as const, label: '경제 뉴스' },
    { key: 'market' as const, label: '증시 정리' },
  ]
  return (
    <div className="flex gap-5 border-b border-line px-1" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={`-mb-px border-b-2 pb-2 text-[14.5px] font-bold ${
            value === t.key ? 'border-brand text-ink' : 'border-transparent text-cap'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
