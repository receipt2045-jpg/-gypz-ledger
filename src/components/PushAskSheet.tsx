import { useEffect, useState } from 'react'
import { useLedgerStore } from '../lib/store'
import { askPushPermission, pushSupported, startPush } from '../lib/pushNative'
import { createPrefs, fetchPrefs, firstConsentText, markAsked, readAskedAt, shouldAskPush } from '../lib/pushPrefs'

/**
 * 처음 알림 안내 (2026-11-04, 푸시 2단계). 앱에서만, 로그인한 우리집 홈에서 한 번.
 * [나중에]·권한 거부면 7일 동안 다시 안 띄운다. 설정 > 알림에서 언제든 켤 수 있다.
 * 광고 동의 체크박스는 기본 해제(정보통신망법).
 */
export default function PushAskSheet() {
  const householdId = useLedgerStore((s) => s.householdId)
  const sample = useLedgerStore((s) => s.sample)
  const [phase, setPhase] = useState<'hidden' | 'ask' | 'done'>('hidden')
  const [promo, setPromo] = useState(false)
  const [busy, setBusy] = useState(false)
  const [doneText, setDoneText] = useState('')

  useEffect(() => {
    if (!pushSupported() || !householdId || sample) return
    if (!shouldAskPush(readAskedAt(), new Date())) return
    let alive = true
    fetchPrefs()
      .then((p) => {
        if (alive && !p) setPhase('ask')
      })
      .catch(() => {
        /* 조용히 넘어간다 — 설정에서 켤 수 있다 */
      })
    return () => {
      alive = false
    }
  }, [householdId, sample])

  if (phase === 'hidden') return null

  const later = () => {
    markAsked(new Date())
    setPhase('hidden')
  }

  const accept = async () => {
    setBusy(true)
    const now = new Date()
    try {
      if (!(await askPushPermission())) return later()
      await createPrefs(promo, now)
      await startPush()
      if (promo) {
        setDoneText(firstConsentText(now))
        setPhase('done')
      } else {
        setPhase('hidden')
      }
    } catch {
      setPhase('hidden')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="알림 안내"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
    >
      <div className="w-full max-w-app rounded-t-[20px] bg-white px-6 pb-8 pt-6">
        {phase === 'done' ? (
          <>
            <p className="text-[17px] font-bold text-ink">알림을 켰어요</p>
            <p className="mt-2 text-[14px] text-sub">{doneText}</p>
            <button
              onClick={() => setPhase('hidden')}
              className="mt-5 h-12 w-full rounded-btn bg-brand text-[15px] font-bold text-white"
            >
              확인
            </button>
          </>
        ) : (
          <>
            <p className="text-[18px] font-extrabold text-ink">놓치지 않게 알려드릴게요</p>
            <ul className="mt-3 space-y-1.5 text-[14px] text-sub">
              <li>· 기록할 시간 · 밤 9시</li>
              <li>· 정산하는 날 · 저녁 8시</li>
              <li>· 오늘의 경제 · 아침 8시</li>
            </ul>
            <label className="mt-4 flex items-start gap-2.5 rounded-btn bg-bg px-3.5 py-3 text-[13.5px] text-ink">
              <input
                type="checkbox"
                checked={promo}
                onChange={(e) => setPromo(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-brand"
              />
              <span>
                결영이네 소식·혜택 알림 받기 <span className="text-cap">(선택, 광고)</span>
              </span>
            </label>
            <button
              onClick={accept}
              disabled={busy}
              className="mt-5 h-12 w-full rounded-btn bg-brand text-[15px] font-bold text-white disabled:opacity-50"
            >
              알림 받기
            </button>
            <button
              onClick={later}
              disabled={busy}
              className="mt-2 h-11 w-full text-[14px] font-semibold text-sub"
            >
              나중에
            </button>
          </>
        )}
      </div>
    </div>
  )
}
