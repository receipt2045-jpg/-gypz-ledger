import { useEffect, useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import { useLedgerStore } from '../lib/store'
import { shareInvite } from '../lib/invite'
import * as db from '../lib/db'

const HIDE_KEY = 'gypz-invite-banner-hidden'

/**
 * 혼자 쓰는 집에 배우자 초대를 권하는 배너.
 *
 * 실측(1,694가구): 부부 둘 다 합류한 집이 255집(15%)뿐이고, 정산까지 끝낸
 * 집은 16집이다. 정산은 둘 다 해야 끝나므로 초대가 병목이다.
 * 초대 기능은 설정 안에 있어서 찾기 어려웠다 — 홈에서 한 번에 보내게 한다.
 */
export default function InviteBanner() {
  const { householdId, inviteCode, sample } = useLedgerStore()
  const [alone, setAlone] = useState(false)
  const [hidden, setHidden] = useState(() => !!localStorage.getItem(HIDE_KEY))
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!householdId || sample) return
    let live = true
    db.fetchMemberCount(householdId)
      .then((n) => live && setAlone(n < 2))
      .catch(() => {
        /* 실패하면 배너를 띄우지 않는다 — 이미 합류했는데 뜨는 게 더 나쁘다 */
      })
    return () => {
      live = false
    }
  }, [householdId, sample])

  if (!alone || hidden || !inviteCode) return null

  const send = async () => {
    const r = await shareInvite(inviteCode)
    if (r === 'copied') setToast('초대 메시지를 복사했어요. 붙여넣기 해주세요')
    else if (r === 'failed') setToast(`초대 코드는 ${inviteCode}예요`)
    if (r !== 'shared') setTimeout(() => setToast(''), 3000)
  }

  const close = () => {
    localStorage.setItem(HIDE_KEY, '1')
    setHidden(true)
  }

  return (
    <div className="relative rounded-card bg-brand/5 px-4 py-3.5">
      <button
        onClick={close}
        aria-label="배너 닫기"
        className="absolute right-2.5 top-2.5 text-cap active:opacity-60"
      >
        <X size={15} />
      </button>
      <p className="pr-6 text-[14px] font-bold text-ink">아직 혼자 쓰고 계세요</p>
      <p className="mt-1 pr-6 text-[12.5px] leading-relaxed text-sub">
        정산은 두 분 다 해야 끝나요. 배우자를 초대하면 같이 볼 수 있어요
      </p>
      <button
        onClick={send}
        className="mt-2.5 flex w-full items-center justify-between rounded-btn bg-brand px-3.5 py-2.5 text-white active:bg-brand-dark"
      >
        <span className="text-[13.5px] font-bold">배우자에게 초대 보내기</span>
        <ChevronRight size={17} className="shrink-0" />
      </button>
      {toast && <p className="mt-2 text-[12px] font-semibold text-brand">{toast}</p>}
    </div>
  )
}
