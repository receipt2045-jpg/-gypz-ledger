import { useNavigate } from 'react-router-dom'
import { ChevronRight, MessagesSquare } from 'lucide-react'
import Card from '../components/Card'
import { NOTICES, type Notice } from '../lib/notices'

/**
 * 게시판 — 지금은 '공지'(새 기능 소식)만 있다.
 *
 * 글쓰기·목록·신고 같은 실제 기능은 누가 쓸 수 있는지, 누가 지우는지를
 * 정한 뒤에 만든다. 4,000명 단톡방이 그대로 들어오면 관리 없이는 못 버틴다.
 */
export default function Board() {
  return (
    <div className="animate-fade-up space-y-4">
      <header className="px-1 pt-2">
        <h1 className="text-[18px] font-bold text-ink">게시판</h1>
      </header>

      <section aria-label="공지" className="space-y-3">
        <p className="px-1 text-[13px] font-bold text-sub">공지</p>
        {NOTICES.map((n) => (
          <NoticeCard key={n.id} notice={n} />
        ))}
      </section>

      <Card>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10">
            <MessagesSquare size={20} className="text-brand" />
          </div>
          <div>
            <p className="text-[14.5px] font-bold text-ink">이야기 나누는 곳은 준비하고 있어요</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-sub">
              다른 집은 어떻게 모으고 있는지 여기서 볼 수 있게 만들고 있어요.
            </p>
          </div>
        </div>
      </Card>
    </div>
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
