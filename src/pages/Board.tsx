import { MessagesSquare } from 'lucide-react'
import Card from '../components/Card'

/**
 * 게시판 — 탭 자리만 먼저 열어 둔다.
 *
 * 글쓰기·목록·신고 같은 실제 기능은 누가 쓸 수 있는지, 누가 지우는지를
 * 정한 뒤에 만든다. 4,000명 단톡방이 그대로 들어오면 관리 없이는 못 버틴다.
 * 그때까지는 빈 화면 대신 무엇이 올지 알려주는 자리로 쓴다.
 */
export default function Board() {
  return (
    <div className="animate-fade-up space-y-4">
      <header className="px-1 pt-2">
        <h1 className="text-[18px] font-bold text-ink">게시판</h1>
      </header>

      <Card>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10">
          <MessagesSquare size={24} className="text-brand" />
        </div>
        <p className="text-[16px] font-bold text-ink">준비하고 있어요</p>
        <p className="mt-2 text-[14px] leading-relaxed text-sub">
          다른 집은 어떻게 모으고 있는지, 결영이네 소식은 뭐가 있는지
          <br />
          여기서 볼 수 있게 만들고 있어요.
        </p>
        <p className="mt-3 text-[12.5px] leading-relaxed text-cap">
          열리면 홈에서 알려드릴게요.
        </p>
      </Card>
    </div>
  )
}
