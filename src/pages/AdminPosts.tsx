import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Send, Trash2 } from 'lucide-react'
import Card from '../components/Card'
import PostCard from '../components/PostCard'
import {
  POST_KIND_LABEL,
  amIAdmin,
  deletePost,
  fetchPosts,
  insertPost,
  kakaoText,
  parsePasted,
  type Post,
  type PostDraft,
  type PostKind,
} from '../lib/posts'

/**
 * 운영자 전용 — '오늘의 경제' 글 올리기.
 * 텔레그램에서 검토한 글을 그대로 붙여넣고 [올리기] → [카톡방에도 보내기].
 * 진짜 권한은 DB(RLS)가 막는다. 여기서는 운영자가 아니면 화면만 안 보여준다.
 */
export default function AdminPosts() {
  const navigate = useNavigate()
  const [admin, setAdmin] = useState<boolean | null>(null)
  const [raw, setRaw] = useState('')
  const [draft, setDraft] = useState<PostDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [posted, setPosted] = useState<string | null>(null) // 방금 올린 원문 — 카톡 보내기용
  const [withLink, setWithLink] = useState(true)
  const [recent, setRecent] = useState<Post[]>([])

  useEffect(() => {
    amIAdmin().then(setAdmin)
    fetchPosts(10)
      .then(setRecent)
      .catch(() => setRecent([]))
  }, [])

  // 붙여넣으면 날짜·제목·종류를 바로 뽑아 둔다 (아래에서 고칠 수 있다)
  const parsed = useMemo(() => (raw.trim() ? parsePasted(raw) : null), [raw])
  useEffect(() => setDraft(parsed), [parsed])

  const submit = async () => {
    if (!draft || !draft.body.trim()) return setMsg('본문이 비어 있어요.')
    setBusy(true)
    setMsg('')
    try {
      const p = await insertPost(draft)
      setRecent((r) => [p, ...r])
      setPosted(raw)
      setRaw('')
      setMsg('앱에 올렸어요.')
    } catch (err) {
      setMsg(
        err instanceof Error && /relation|does not exist/.test(err.message)
          ? '글 저장 칸이 아직 없어요. Supabase에서 posts.sql을 먼저 실행해 주세요.'
          : '올리지 못했어요. 운영자 계정으로 로그인했는지 확인해 주세요.',
      )
    } finally {
      setBusy(false)
    }
  }

  const shareKakao = async () => {
    if (!posted) return
    const text = kakaoText(posted, withLink)
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      setMsg('글을 복사했어요. 카톡방에 붙여넣어 주세요.')
    } catch {
      setMsg('복사가 안 되는 브라우저예요.')
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm('이 글을 지울까요? 지우면 되돌릴 수 없어요.')) return
    try {
      await deletePost(id)
      setRecent((r) => r.filter((p) => p.id !== id))
    } catch {
      setMsg('지우지 못했어요.')
    }
  }

  return (
    <div className="flex min-h-screen justify-center bg-[#e6e9ed]">
      <div className="relative flex min-h-screen w-full max-w-app flex-col bg-bg px-5 pb-16 shadow-[0_0_60px_rgba(0,0,0,0.06)]">
        <div className="pb-3 pt-4">
          <button
            onClick={() => navigate('/info')}
            className="mb-2 text-ink active:opacity-60"
            aria-label="뒤로"
          >
            <ChevronLeft size={26} />
          </button>
          <h1 className="text-[22px] font-extrabold text-ink">오늘의 경제 올리기</h1>
        </div>

        {admin === false && (
          <Card>
            <p className="text-[14px] text-sub">운영자 계정으로 로그인해야 쓸 수 있어요.</p>
          </Card>
        )}

        {admin && (
          <div className="space-y-4">
            <Card>
              <p className="text-[13.5px] font-medium text-sub">
                톡방에 올릴 글을 그대로 붙여넣어 주세요
              </p>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={10}
                placeholder={
                  '[결영이네] 10월 2일\n오늘의 경제 뉴스\n\n🔰 오늘 딱 하나만 읽는다면\n…'
                }
                className="mt-2 w-full resize-y rounded-btn border border-line bg-white p-3 text-[14px] leading-relaxed text-ink outline-none focus:border-brand"
              />

              {draft && (
                <div className="mt-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[12.5px] text-sub">
                      종류
                      <select
                        value={draft.kind}
                        onChange={(e) => setDraft({ ...draft, kind: e.target.value as PostKind })}
                        className="mt-1 w-full rounded-btn border border-line bg-white px-2 py-2 text-[14px] text-ink"
                      >
                        {(Object.keys(POST_KIND_LABEL) as PostKind[]).map((k) => (
                          <option key={k} value={k}>
                            {POST_KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[12.5px] text-sub">
                      날짜
                      <input
                        type="date"
                        value={draft.postDate}
                        onChange={(e) => setDraft({ ...draft, postDate: e.target.value })}
                        className="mt-1 w-full rounded-btn border border-line bg-white px-2 py-2 text-[14px] text-ink"
                      />
                    </label>
                  </div>
                  <label className="block text-[12.5px] text-sub">
                    제목
                    <input
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                      className="mt-1 w-full rounded-btn border border-line bg-white px-3 py-2 text-[14px] text-ink"
                    />
                  </label>
                  <p className="pt-1 text-[12.5px] font-medium text-sub">앱에서 이렇게 보여요</p>
                  <PostCard post={{ ...draft, id: 'preview', createdAt: '' }} preview />
                </div>
              )}

              <button
                onClick={submit}
                disabled={!draft || busy}
                className="mt-4 w-full rounded-btn bg-brand py-3.5 text-[15px] font-bold text-white disabled:opacity-40"
              >
                {busy ? '올리는 중…' : '앱에 올리기'}
              </button>
            </Card>

            {posted && (
              <Card>
                <p className="text-[15px] font-bold text-ink">톡방에도 보낼까요?</p>
                <label className="mt-2 flex items-center gap-2 text-[13px] text-sub">
                  <input
                    type="checkbox"
                    checked={withLink}
                    onChange={(e) => setWithLink(e.target.checked)}
                  />
                  끝에 "지난 글은 모아불리에서" 링크 붙이기
                </label>
                <button
                  onClick={shareKakao}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-btn bg-[#FEE500] py-3.5 text-[15px] font-bold text-[#191919]"
                >
                  <Send size={16} />
                  카톡방에도 보내기
                </button>
              </Card>
            )}

            {msg && <p className="text-center text-[13px] font-semibold text-brand">{msg}</p>}

            {recent.length > 0 && (
              <section className="space-y-2">
                <p className="px-1 text-[13px] font-bold text-sub">최근 올린 글</p>
                {recent.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-card bg-white px-4 py-3"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                      {p.postDate.slice(5).replace('-', '/')} · {p.title}
                    </span>
                    <button
                      onClick={() => remove(p.id)}
                      aria-label={`${p.title} 지우기`}
                      className="ml-2 text-cap"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
