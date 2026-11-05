import { useEffect, useId, useState } from 'react'
import Toggle from './Toggle'
import { isNative } from '../lib/native'
import { askPushPermission, pushPermission, pushSupported, startPush, type PushPermission } from '../lib/pushNative'
import {
  TIME_SLOTS,
  consentNotice,
  createPrefs,
  fetchPrefs,
  setPromo,
  timeLabel,
  updatePrefs,
  type NotificationPrefs,
  type PrefsPatch,
} from '../lib/pushPrefs'

const FAIL = '바꾸지 못했어요. 잠시 후 다시 해 주세요'

/**
 * 설정 > 알림 (2026-11-04, 푸시 2단계).
 * 웹은 안내 한 줄. 앱은 종류별 스위치 + 리마인더 시각. 광고 스위치는 바꾸는 즉시 처리 결과를 알린다(정보통신망법).
 */
export default function NotificationSettings() {
  if (!isNative()) return <p className="text-[13.5px] text-sub">알림은 모아불리 앱에서 받을 수 있어요</p>
  if (!pushSupported()) return <p className="text-[13.5px] text-sub">앱을 업데이트하면 알림을 받을 수 있어요</p>
  return <AppNotificationSettings />
}

function AppNotificationSettings() {
  const [loaded, setLoaded] = useState(false)
  const [perm, setPerm] = useState<PushPermission>('prompt')
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [msg, setMsg] = useState('')
  const [hint, setHint] = useState('')

  useEffect(() => {
    let alive = true
    // 읽기 실패와 "설정 없음"을 구분한다 — 실패했을 때 켜기 카드를 보이면 있는 설정을 덮어쓸 수 있다
    Promise.all([
      pushPermission(),
      fetchPrefs().then(
        (pr) => ({ pr, failed: false }),
        () => ({ pr: null, failed: true }),
      ),
    ]).then(([p, { pr, failed }]) => {
      if (!alive) return
      setPerm(p)
      setPrefs(pr)
      setLoadFailed(failed)
      setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!loaded) return null
  if (loadFailed) {
    return <p className="text-[13.5px] font-medium text-danger">알림 설정을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>
  }

  const enable = async () => {
    setHint('')
    setMsg('')
    if (!(await askPushPermission())) {
      setPerm('denied')
      setHint('폰 설정 > 애플리케이션 > 모아불리 > 알림에서 켜 주세요')
      return
    }
    setPerm('granted')
    try {
      setPrefs(prefs ?? (await createPrefs(false, new Date())))
      await startPush()
    } catch {
      setMsg('켜지 못했어요. 잠시 후 다시 해 주세요')
    }
  }

  const enableCard = (
    <div className="rounded-btn bg-bg px-4 py-3">
      <p className="text-[14px] font-semibold text-ink">
        {perm === 'denied' ? '폰 설정에서 알림이 꺼져 있어요' : '알림이 아직 꺼져 있어요'}
      </p>
      <button
        onClick={enable}
        className="mt-2 h-10 rounded-btn bg-brand px-4 text-[14px] font-bold text-white active:bg-brand-dark"
      >
        알림 켜기
      </button>
      {hint && <p className="mt-2 text-[12.5px] text-sub">{hint}</p>}
      {msg && !prefs && <p className="mt-2 text-[12.5px] font-medium text-danger">{msg}</p>}
    </div>
  )

  // 설정이 아직 없는 사람
  if (!prefs) return enableCard

  const change = async (patch: PrefsPatch) => {
    const before = prefs
    setPrefs({ ...prefs, ...patch })
    setMsg('')
    try {
      await updatePrefs(patch)
    } catch {
      setPrefs(before)
      setMsg(FAIL)
    }
  }

  const changePromo = async (on: boolean) => {
    const before = prefs
    const now = new Date()
    setPrefs({ ...prefs, promoOn: on, promoConsentAt: on ? now.toISOString() : prefs.promoConsentAt })
    setMsg('')
    try {
      await setPromo(on, now)
      setMsg(consentNotice(on, now))
    } catch {
      setPrefs(before)
      setMsg(FAIL)
    }
  }

  return (
    <div className="space-y-2">
      {/* 폰 알림 권한이 꺼져 있어도 스위치(특히 광고 동의 철회)는 그대로 보인다 */}
      {perm !== 'granted' && enableCard}
      <div>
        <SwitchRow
          label="기록 리마인더"
          desc={`매일 ${timeLabel(prefs.reminderTime)}, 기록 안 한 날만`}
          checked={prefs.reminderOn}
          onChange={(v) => change({ reminderOn: v })}
        />
        <div className="mt-1 flex items-center justify-between rounded-btn bg-bg px-4 py-2.5">
          <span className="text-[12.5px] text-sub">알림 시각</span>
          <select
            aria-label="리마인더 시각"
            value={prefs.reminderTime}
            disabled={!prefs.reminderOn}
            onChange={(e) => change({ reminderTime: e.target.value })}
            className="rounded-btn border border-line bg-white px-2 py-1.5 text-[14px] text-ink disabled:opacity-40"
          >
            {TIME_SLOTS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      <SwitchRow label="월말 정산" desc="정산일 저녁 8시" checked={prefs.settleOn} onChange={(v) => change({ settleOn: v })} />
      <SwitchRow label="오늘의 경제·공지" desc="매일 아침 8시" checked={prefs.newsOn} onChange={(v) => change({ newsOn: v })} />
      <SwitchRow label="결영이네 소식·혜택" desc="광고성 알림 · 동의한 분께만" checked={prefs.promoOn} onChange={changePromo} />
      {msg && <p className="pl-1 text-[12.5px] font-medium text-brand">{msg}</p>}
    </div>
  )
}

function SwitchRow({
  label,
  desc,
  checked,
  onChange,
  disabled,
}: {
  label: string
  desc?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-3 rounded-btn bg-bg px-4 py-3">
      <label htmlFor={id} className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold text-ink">{label}</span>
        {desc && <span className="block text-[12px] text-sub">{desc}</span>}
      </label>
      <Toggle id={id} label={label} checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}
