import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Card from './Card'
import { POST_KIND_LABEL, linkify, type Post } from '../lib/posts'

/** 본문이 이 줄 수를 넘으면 접어 두고 '더 보기' */
const FOLD_LINES = 6

/** '오늘의 경제' 글 한 개 — 기사 주소는 눌러지는 링크로 */
export default function PostCard({
  post,
  defaultOpen = false,
}: {
  post: Post
  defaultOpen?: boolean
}) {
  const lines = post.body.split('\n')
  const long = lines.length > FOLD_LINES
  const [open, setOpen] = useState(defaultOpen || !long)
  const shown = open ? post.body : lines.slice(0, FOLD_LINES).join('\n')
  const [, m, d] = post.postDate.split('-')

  return (
    <Card>
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
      <p className="mt-2 text-[16px] font-bold text-ink">{post.title}</p>
      <div className="relative">
        <p className="mt-2 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-sub">
          {linkify(shown).map((s, i) =>
            s.type === 'link' ? (
              <a
                key={i}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-brand underline underline-offset-2"
              >
                기사 보기
              </a>
            ) : (
              <span key={i}>{s.text}</span>
            ),
          )}
        </p>
        {!open && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
        )}
      </div>
      {long && (
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded-btn bg-bg py-2.5 text-[13px] font-bold text-sub"
          aria-expanded={open}
        >
          {open ? '접기' : '더 보기'}
          <ChevronDown size={15} className={open ? 'rotate-180' : ''} />
        </button>
      )}
    </Card>
  )
}
