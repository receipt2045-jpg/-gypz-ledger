import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import NewsArchive from '../components/NewsArchive'

/** 정보 탭 → '지난 글 모아 보기' — 오늘의 경제를 달별로 (2026-10-06) */
export default function InfoArchive() {
  const navigate = useNavigate()
  return (
    <div className="animate-fade-up space-y-3">
      <button
        onClick={() => navigate('/info')}
        className="-ml-1 flex items-center gap-0.5 pt-2 text-[14px] font-semibold text-sub"
      >
        <ChevronLeft size={19} />
        정보
      </button>
      <h1 className="px-1 text-[20px] font-bold text-ink">오늘의 경제</h1>
      <NewsArchive basePath="/info" />
    </div>
  )
}
