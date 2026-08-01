import { useEffect } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { flushPendingSync, useLedgerStore } from '../lib/store'

/**
 * 저장이 아직 서버에 안 넘어간 게 있으면 알려준다.
 * 화면은 낙관적으로 먼저 바뀌므로, 이게 없으면 사용자는 저장된 줄 알고 앱을 닫는다.
 */
export default function SyncBanner() {
  const pending = useLedgerStore((s) => s.pendingSync)
  const failed = useLedgerStore((s) => s.syncFailed)

  // 연결이 돌아오거나 앱으로 되돌아오면 자동으로 다시 시도
  useEffect(() => {
    const retry = () => {
      void flushPendingSync()
    }
    window.addEventListener('online', retry)
    document.addEventListener('visibilitychange', retry)
    return () => {
      window.removeEventListener('online', retry)
      document.removeEventListener('visibilitychange', retry)
    }
  }, [])

  if (!pending && !failed) return null

  return (
    <div className="fixed left-1/2 top-0 z-50 w-full max-w-app -translate-x-1/2 px-3 pt-2">
      <div className="flex items-center justify-between gap-2 rounded-card bg-amber-500 px-4 py-2.5 text-white shadow-lg">
        <span className="flex items-center gap-2 text-[13px] font-medium">
          <CloudOff size={15} className="shrink-0" />
          {pending > 0
            ? `저장 대기 ${pending}건 · 연결되면 자동으로 저장돼요`
            : '저장하지 못했어요. 다시 시도해 주세요'}
        </span>
        <button
          onClick={() => void flushPendingSync()}
          className="flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-[12px] font-bold active:bg-white/30"
        >
          <RefreshCw size={13} />
          다시 시도
        </button>
      </div>
    </div>
  )
}
