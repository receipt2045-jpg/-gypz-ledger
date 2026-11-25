import { useEffect, useState } from 'react'
import Card from '../components/Card'
import { fetchPosts, type Post } from '../lib/posts'
import {
  CAMPAIGN_KIND_LABEL,
  PATH_OPTIONS,
  STATUS_LABEL,
  audienceCount,
  cancelCampaign,
  createCampaign,
  fetchCampaigns,
  kstSendAt,
  previewText,
  promoHourOk,
  scheduleError,
  sendAtLabel,
  timeSlotsFor,
  type Campaign,
  type CampaignKind,
} from '../lib/pushAdmin'

/** push-dispatch는 5분마다 돈다 — 20:55 이후에 적은 홍보는 다음 실행이 21:00 이후라 08:00으로 미뤄진다 */
const DISPATCH_LAG_MS = 5 * 60 * 1000

const field ='mt-1 w-full rounded-btn border border-line bg-white px-3 py-2 text-[14px] text-ink'

/**
 * 관리자 > 알림 보내기 (2026-11-04, 푸시 2단계). /admin/posts의 두 번째 탭.
 * 적어 두면 push-dispatch가 5분 안에 보낸다. 홍보는 21~08시 예약 불가, 미리보기에 (광고)·수신 거부가 붙는다.
 */
export default function AdminPush() {
  const [kind, setKind] = useState<CampaignKind>('notice')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [path, setPath] = useState('/')
  const [when, setWhen] = useState<'now' | 'later'>('now')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [list, setList] = useState<Campaign[]>([])
  const [posts, setPosts] = useState<Post[]>([])

  const reload = () =>
    fetchCampaigns()
      .then(setList)
      .catch(() => setList([]))

  useEffect(() => {
    fetchCampaigns()
      .then(setList)
      .catch(() => setList([]))
    fetchPosts(10)
      .then(setPosts)
      .catch(() => setPosts([]))
  }, [])

  const slots = timeSlotsFor(kind)
  const preview = previewText(kind, title || '제목', body || '내용')

  const changeKind = (k: CampaignKind) => {
    setKind(k)
    if (time && !timeSlotsFor(k).includes(time)) setTime('')
  }

  const submit = async () => {
    if (!title.trim() || !body.trim()) return setMsg('제목과 내용을 적어 주세요.')
    const now = new Date()
    if (when === 'later') {
      const err = scheduleError(kind, date, time, now)
      if (err) return setMsg(err)
    }
    setBusy(true)
    setMsg('')
    try {
      const count = await audienceCount(kind)
      if (!window.confirm(`${count}명에게 보내요. 보낼까요?`)) return
      await createCampaign({
        kind,
        title: title.trim(),
        body: body.trim(),
        path,
        sendAt: when === 'now' ? now.toISOString() : kstSendAt(date, time),
      })
      setTitle('')
      setBody('')
      setMsg(
        when === 'later'
          ? '예약했어요.'
          : kind === 'promo' && !promoHourOk(new Date(now.getTime() + DISPATCH_LAG_MS))
            ? '광고 알림은 아침 8시에 보내져요.'
            : '5분 안에 보내져요.',
      )
      await reload()
    } catch {
      setMsg('보내지 못했어요. push.sql을 실행했는지 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (c: Campaign) => {
    try {
      await cancelCampaign(c.id)
      await reload()
    } catch {
      setMsg('취소하지 못했어요.')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-2.5">
          <label className="block text-[12.5px] text-sub">
            종류
            <select
              aria-label="종류"
              value={kind}
              onChange={(e) => changeKind(e.target.value as CampaignKind)}
              className={field}
            >
              <option value="notice">{CAMPAIGN_KIND_LABEL.notice}</option>
              <option value="promo">{CAMPAIGN_KIND_LABEL.promo}</option>
            </select>
          </label>
          <label className="block text-[12.5px] text-sub">
            제목
            <input aria-label="제목" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} className={field} />
          </label>
          <label className="block text-[12.5px] text-sub">
            내용
            <textarea
              aria-label="내용"
              maxLength={300}
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={field}
            />
          </label>
          <label className="block text-[12.5px] text-sub">
            열릴 화면
            <select aria-label="열릴 화면" value={path} onChange={(e) => setPath(e.target.value)} className={field}>
              {PATH_OPTIONS.map((o) => (
                <option key={o.path} value={o.path}>
                  {o.label}
                </option>
              ))}
              {posts.map((p) => (
                <option key={p.id} value={`/info/${p.id}`}>
                  글: {p.title}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-4 pt-1 text-[14px] text-ink">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="when" checked={when === 'now'} onChange={() => setWhen('now')} />
              지금 보내기
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="when" checked={when === 'later'} onChange={() => setWhen('later')} />
              예약
            </label>
          </div>
          {when === 'later' && (
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="예약 날짜" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
              <select aria-label="시각" value={time} onChange={(e) => setTime(e.target.value)} className={field}>
                <option value="">시각</option>
                {slots.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          )}
          {kind === 'promo' && <p className="text-[12px] text-cap">광고 알림은 아침 8시부터 저녁 9시 전까지만 보내요.</p>}

          <p className="pt-1 text-[12.5px] font-medium text-sub">폰에 이렇게 보여요</p>
          <div className="rounded-card bg-bg px-4 py-3">
            <p className="text-[14px] font-bold text-ink">{preview.title}</p>
            <p className="mt-0.5 whitespace-pre-line text-[13px] text-sub">{preview.body}</p>
          </div>
        </div>
        <button
          onClick={submit}
          disabled={busy}
          className="mt-4 w-full rounded-btn bg-brand py-3.5 text-[15px] font-bold text-white disabled:opacity-40"
        >
          보내기
        </button>
      </Card>

      {msg && <p className="text-center text-[13px] font-semibold text-brand">{msg}</p>}

      {list.length > 0 && (
        <section className="space-y-2">
          <p className="px-1 text-[13px] font-bold text-sub">보낸·예약한 알림</p>
          {list.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-card bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-ink">
                  {sendAtLabel(c.sendAt)} · {CAMPAIGN_KIND_LABEL[c.kind]} · {c.title}
                </p>
                <p className="text-[12px] text-cap">
                  {STATUS_LABEL[c.status]}
                  {c.status === 'sent' && ` ${c.sentCount}명 · 실패 ${c.failCount}`}
                </p>
              </div>
              {c.status === 'scheduled' && (
                <button
                  onClick={() => cancel(c)}
                  aria-label={`${c.title} 예약 취소`}
                  className="ml-2 shrink-0 text-[12.5px] font-semibold text-danger"
                >
                  취소
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
