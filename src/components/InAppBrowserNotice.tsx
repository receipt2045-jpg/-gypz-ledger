import { ExternalLink } from 'lucide-react'
import { detectInAppBrowser, IN_APP_LABEL, openExternally } from '../lib/inAppBrowser'

/**
 * 인앱 브라우저에서 열었을 때 크롬·사파리로 옮기라고 안내한다.
 * 여기서 옮기지 않으면 앱을 닫을 때마다 로그인이 풀린다.
 */
export default function InAppBrowserNotice() {
  const kind = detectInAppBrowser()
  if (!kind) return null

  const label = IN_APP_LABEL[kind]

  return (
    <div className="rounded-card bg-amber-50 px-4 py-3.5">
      <p className="text-[13.5px] font-bold text-amber-800">
        {label} 안에서 열면 로그인이 자꾸 풀려요
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-amber-700">
        {kind === 'kakao'
          ? '아래 버튼으로 한 번만 옮기면 다음부터 로그인 상태가 유지돼요.'
          : '오른쪽 위 ··· 을 눌러 "브라우저로 열기"를 선택해 주세요. 한 번만 옮기면 로그인이 유지돼요.'}
      </p>
      {kind === 'kakao' && (
        <button
          onClick={() => openExternally(kind)}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-btn bg-amber-500 py-2.5 text-[13.5px] font-bold text-white active:bg-amber-600"
        >
          <ExternalLink size={15} />
          크롬·사파리로 열기
        </button>
      )}
    </div>
  )
}
