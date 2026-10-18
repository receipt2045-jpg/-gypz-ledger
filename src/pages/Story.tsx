import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import PcShell from '../components/PcShell'
import { detectInAppBrowser } from '../lib/inAppBrowser'

/** 원팀 프로젝트 이야기 페이지 — 결영이네가 따로 고치는 페이지라, 앱에선 그대로 띄우기만 한다 */
export const STORY_URL = 'https://receipt2045-jpg.github.io/oneteam-dashboard/story/'

/**
 * 원팀 프로젝트 이야기 (2026-10-18) — 돈 공부 탭 '이야기'에서 들어온다.
 * 바깥 페이지를 앱 안에서 본다(iframe). 페이지가 바뀌면 앱도 바로 바뀐다.
 * 띄우려면 public/_headers CSP의 frame-src에 github.io 주소가 있어야 한다.
 */
export default function Story() {
  const navigate = useNavigate()
  // 카톡·인스타 같은 앱 안 브라우저는 페이지 속(iframe) 버튼이 새 창을 못 띄워서 '6기 신청'이 안 눌렸다 (2026-10-18 제보).
  // 거기서 열면 이야기 페이지로 바로 넘어간다 — 버튼이 제대로 동작한다.
  const inApp = detectInAppBrowser() !== null
  useEffect(() => {
    if (inApp) window.location.replace(STORY_URL)
  }, [inApp])
  if (inApp) return null
  return (
    <PcShell active="/info">
      <div className="flex h-[100dvh] justify-center bg-[#e6e9ed] lg:bg-bg">
        <div className="flex w-full max-w-app flex-col bg-white lg:max-w-[720px]">
          <header className="flex shrink-0 items-center gap-1 border-b border-line px-2 py-2">
            <button
              onClick={() => navigate(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink active:bg-line"
              aria-label="뒤로"
            >
              <ChevronLeft size={24} />
            </button>
            <h1 className="flex-1 truncate text-[16px] font-bold text-ink">원팀 프로젝트 이야기</h1>
            <a
              href={STORY_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold text-sub active:bg-bg"
            >
              새 창 <ExternalLink size={13} />
            </a>
          </header>
          <iframe
            src={STORY_URL}
            title="원팀 프로젝트 5기 이야기"
            className="w-full flex-1 border-0"
            loading="lazy"
          />
        </div>
      </div>
    </PcShell>
  )
}
