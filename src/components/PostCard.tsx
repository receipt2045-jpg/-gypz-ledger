import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import Card from './Card'
import { POST_KIND_LABEL, linkify, type Post } from '../lib/posts'

/** 목록에서 보이는 앞부분 줄 수 — 나머지는 '자세히 보기'에서 (2026-10-06: 글이 너무 길었다) */
const PREVIEW_LINES = 3

export function PostMeta({ post }: { post: Post }) {
  const [, m, d] = post.postDate.split('-')
  return (
    <div className="flex items-center gap-2">
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
          post.kind === 'market' ? 'bg-[#E6F7EF] text-[#12A56B]' : 'bg-brand/10 text-brand'
        }`}
      >
        {POST_KIND_LABEL[post.kind]}
      </span>
      <span className="text-[12px] text-cap">
        {Number(m)}월 {Number(d)}일
      </span>
    </div>
  )
}

/** 본문 — 기사 주소는 '기사 보기' 링크로 */
export function PostBody({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-sub">
      {linkify(text).map((s, i) =>
        s.type === 'link' ? (
          <a
            key={i}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand underline underline-offset-2"
          >
            기사 보기
          </a>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </p>
  )
}

/**
 * '오늘의 경제' 글 — 목록용. 제목과 앞 몇 줄만 보여주고 [자세히 보기]로 전체 화면에 간다.
 * preview(관리자 미리보기)에서는 이동 대신 버튼만 그려 둔다.
 */
export default function PostCard({
  post,
  preview = false,
  basePath = '/info',
}: {
  post: Post
  preview?: boolean
  /** 자세히 보기로 갈 곳 — 앱 안은 /info, 로그인 없는 공개 화면은 /news */
  basePath?: string
}) {
  const navigate = useNavigate()
  const head = post.body
    .split('\n')
    .filter((l) => l.trim())
    .slice(0, PREVIEW_LINES)
    .join('\n')

  return (
    <Card>
      <PostMeta post={post} />
      <p className="mt-2 text-[16px] font-bold text-ink">{post.title}</p>
      <div className="mt-2 line-clamp-4">
        <PostBody text={head} />
      </div>
      <button
        onClick={() => !preview && navigate(`${basePath}/${post.id}`)}
        className="mt-3 flex w-full items-center justify-center gap-1 rounded-btn bg-bg py-2.5 text-[13.5px] font-bold text-sub"
      >
        자세히 보기
        <ChevronRight size={15} />
      </button>
    </Card>
  )
}
