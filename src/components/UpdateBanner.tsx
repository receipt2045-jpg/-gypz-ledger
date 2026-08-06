import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { isUpdateAvailable } from '../lib/appVersion'

/**
 * 새 버전이 배포되면 띄우는 띠.
 *
 * 자동으로 새로고침하지는 않는다 — 입력하던 중에 화면이 날아가면 더 나쁘다.
 * 대신 앱으로 돌아올 때마다 확인해서, 누르기만 하면 최신으로 바뀌게 한다.
 */
export default function UpdateBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let alive = true
    const check = async () => {
      if (!alive || show) return
      if (await isUpdateAvailable()) setShow(true)
    }

    check()
    // 앱으로 돌아올 때 (홈 화면 앱은 이때가 사실상의 '재실행')
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    // 오래 켜둔 경우 대비
    const timer = setInterval(check, 30 * 60 * 1000)

    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [show])

  if (!show) return null

  return (
    <div className="fixed left-1/2 top-0 z-50 w-full max-w-app -translate-x-1/2 px-3 pt-2">
      <button
        onClick={() => window.location.reload()}
        className="flex w-full items-center justify-between gap-2 rounded-card bg-ink px-4 py-2.5 text-left text-white shadow-lg active:opacity-90"
      >
        <span className="text-[13px] font-medium">새 버전이 나왔어요</span>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-[12px] font-bold">
          <RefreshCw size={12} />
          새로고침
        </span>
      </button>
    </div>
  )
}
