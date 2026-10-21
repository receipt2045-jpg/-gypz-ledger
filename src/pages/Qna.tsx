import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, EyeOff, Share2, Trash2 } from 'lucide-react'
import SiteFooter from '../components/SiteFooter'
import { supabase } from '../lib/supabase'
import { ONETEAM_URL } from '../components/CalcShell'
import {
  QNA_CATEGORIES,
  addAnswer,
  amIStaff,
  categoryOf,
  createQuestion,
  deleteAnswer,
  deleteQuestion,
  fetchQuestion,
  fetchQuestions,
  qnaLink,
  qnaListLink,
  setQuestionHidden,
  shareLink,
  type Answer,
  type QnaCategory,
  type Question,
} from '../lib/qna'

/**
 * 묻고 답하기 (2026-10-21) — /qna 목록 · /qna/new 질문 쓰기 · /qna/:id 질문과 답.
 * 로그인 밖에 둔다 — 답 달린 질문 링크를 유튜브·인스타에 걸면 가입 없이 읽힌다.
 * 질문은 로그인해야 쓰고, 답은 결영이네(staff)만 단다.
 */
export default function Qna() {
  const { id } = useParams()
  return (
    <div className="flex min-h-screen justify-center bg-bg">
      <div className="w-full max-w-app px-5 pb-16 pt-5 lg:max-w-[720px]">
        {id === 'new' ? <QnaNew /> : id ? <QnaDetail id={id} /> : <QnaList />}
        <SiteFooter />
      </div>
    </div>
  )
}

function useSignedIn() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session))
  }, [])
  return signedIn
}

function useStaff() {
  const [staff, setStaff] = useState(false)
  useEffect(() => {
    void amIStaff().then(setStaff)
  }, [])
  return staff
}

const dateLabel = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

function Back({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      className="-ml-2 flex items-center gap-0.5 rounded-full px-2 py-1 text-[14px] font-semibold text-sub active:bg-line"
    >
      <ChevronLeft size={18} /> {label}
    </button>
  )
}

function CategoryBadge({ category }: { category: QnaCategory }) {
  const c = categoryOf(category)
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-bold ${c.tone}`}>{c.label}</span>
  )
}

// ── 목록 ───────────────────────────────────────

function QnaList() {
  const navigate = useNavigate()
  const signedIn = useSignedIn()
  const [cat, setCat] = useState<QnaCategory | null>(null)
  const [list, setList] = useState<Question[] | null>(null)
  const [error, setError] = useState(false)
  const [shared, setShared] = useState('')

  useEffect(() => {
    let live = true
    setList(null)
    fetchQuestions(cat ?? undefined)
      .then((q) => live && setList(q))
      .catch(() => live && setError(true))
    return () => {
      live = false
    }
  }, [cat])

  return (
    <div className="animate-fade-up space-y-3">
      {signedIn && <Back to="/" label="가계부로" />}
      <header className="flex items-end justify-between px-1">
        <div>
          <p className="text-[12.5px] font-bold text-brand">결영이네</p>
          <h1 className="text-[22px] font-bold text-ink">묻고 답하기</h1>
          <p className="mt-0.5 text-[13px] text-sub">돈 고민을 남기면 결영이네가 답해요</p>
        </div>
        <button
          onClick={async () => {
            const r = await shareLink(qnaListLink(), '결영이네 묻고 답하기')
            setShared(r === 'copied' ? '링크를 복사했어요' : r === 'failed' ? qnaListLink() : '')
          }}
          className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-bold text-sub shadow-card active:bg-line"
        >
          <Share2 size={14} /> 공유
        </button>
      </header>
      {shared && <p className="px-1 text-[12px] text-brand">{shared}</p>}

      <button
        onClick={() => navigate('/qna/new')}
        className="flex w-full items-center justify-between rounded-card bg-brand px-4 py-3.5 text-left text-white shadow-cta active:bg-brand-dark"
      >
        <span>
          <span className="block text-[15px] font-bold">질문하기</span>
          <span className="block text-[12.5px] text-white/80">
            주식 · 내집마련 · SNS 부수입 · 부부 돈 관리
          </span>
        </span>
        <ChevronRight size={18} />
      </button>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist">
        {[null, ...QNA_CATEGORIES.map((c) => c.key)].map((k) => (
          <button
            key={k ?? 'all'}
            role="tab"
            aria-selected={cat === k}
            onClick={() => setCat(k)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-bold ${
              cat === k ? 'bg-ink text-white' : 'bg-white text-sub shadow-card'
            }`}
          >
            {k ? categoryOf(k).label : '전체'}
          </button>
        ))}
      </div>

      {error && (
        <p className="rounded-card bg-white px-4 py-6 text-center text-[13px] text-sub">
          질문을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
        </p>
      )}
      {!error && list === null && (
        <p className="px-1 py-6 text-center text-[13px] text-cap">불러오는 중…</p>
      )}
      {list && list.length === 0 && (
        <p className="rounded-card bg-white px-4 py-6 text-center text-[13px] leading-relaxed text-sub">
          아직 질문이 없어요.
          <br />첫 질문을 남겨 주세요.
        </p>
      )}
      {list?.map((q) => (
        <button
          key={q.id}
          onClick={() => navigate(`/qna/${q.id}`)}
          className="block w-full rounded-card bg-white px-4 py-3.5 text-left shadow-card active:bg-line/40"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <CategoryBadge category={q.category} />
            {q.answered ? (
              <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11.5px] font-bold text-teal-700">
                답변 완료
              </span>
            ) : (
              <span className="rounded-full bg-bg px-2 py-0.5 text-[11.5px] font-bold text-sub">
                답변 기다리는 중
              </span>
            )}
            {q.hidden && (
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11.5px] font-bold text-danger">
                숨김
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[15px] font-bold leading-snug text-ink">{q.title}</p>
          <p className="mt-1 text-[12px] text-cap">
            {q.mine ? '내 질문' : q.nickname} · {dateLabel(q.createdAt)}
          </p>
        </button>
      ))}
    </div>
  )
}

// ── 질문 쓰기 ──────────────────────────────────

function QnaNew() {
  const navigate = useNavigate()
  const signedIn = useSignedIn()
  const [cat, setCat] = useState<QnaCategory | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const ready = !!cat && title.trim().length >= 2 && body.trim().length >= 5 && agreed

  const submit = async () => {
    if (!cat) return setError('어떤 이야기인지 골라 주세요')
    if (title.trim().length < 2) return setError('제목을 적어 주세요')
    if (body.trim().length < 5) return setError('내용을 조금 더 적어 주세요')
    if (!agreed) return setError('아래 안내를 확인하고 체크해 주세요')
    setBusy(true)
    setError('')
    try {
      const id = await createQuestion({ category: cat, title, body })
      navigate(`/qna/${id}`, { replace: true })
    } catch {
      setError('올리지 못했어요. 잠시 뒤 다시 눌러 주세요.')
      setBusy(false)
    }
  }

  if (signedIn === false) {
    return (
      <div className="space-y-3">
        <Back to="/qna" label="묻고 답하기" />
        <div className="rounded-card bg-white px-5 py-6 text-center shadow-card">
          <p className="text-[16px] font-bold text-ink">로그인하면 질문할 수 있어요</p>
          <p className="mt-1 text-[13px] text-sub">모아불리 가계부 계정으로 남겨 주세요</p>
          <a
            href="#/"
            className="mt-4 inline-flex rounded-btn bg-brand px-5 py-3 text-[14px] font-bold text-white"
          >
            로그인하러 가기
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-up space-y-3">
      <Back to="/qna" label="묻고 답하기" />
      <h1 className="px-1 text-[20px] font-bold text-ink">질문하기</h1>

      <div className="space-y-3 rounded-card bg-white p-4 shadow-card">
        <div>
          <p className="mb-1.5 text-[13px] font-bold text-sub">어떤 이야기예요?</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="분류">
            {QNA_CATEGORIES.map((c) => (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                aria-pressed={cat === c.key}
                className={`rounded-full px-3 py-1.5 text-[13px] font-bold ${
                  cat === c.key ? 'bg-ink text-white' : 'bg-bg text-sub'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 80))}
          placeholder="제목 (예: 전세 만기 1년 남았는데 청약 vs 매매)"
          aria-label="제목"
          className="w-full rounded-btn border border-line px-3.5 py-3 text-[15px] font-semibold text-ink outline-none focus:border-brand placeholder:font-normal placeholder:text-cap"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, 2000))}
          rows={7}
          placeholder="우리집 상황을 적어 주면 더 정확히 답할 수 있어요 (월급, 모은 돈, 고민하는 이유)"
          aria-label="내용"
          className="w-full resize-none rounded-btn border border-line px-3.5 py-3 text-[14.5px] leading-relaxed text-ink outline-none focus:border-brand placeholder:text-cap"
        />
        <p className="text-right text-[11.5px] text-cap">{body.length} / 2000</p>
      </div>

      {/* 콘텐츠 활용 안내 — 체크해야 올릴 수 있다 (2026-10-21 결영 요청). 체크한 시각을 함께 저장한다 */}
      <div className="rounded-card bg-[#FFF9DB] p-4">
        <p className="text-[14px] font-bold text-[#5C3B00]">📢 질문은 콘텐츠로 쓰일 수 있어요</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#5C3B00]">
          남겨 주신 질문과 답변은 결영이네 유튜브·인스타 콘텐츠로 소개될 수 있어요. 이름과 닉네임은
          가려요.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-[#5C3B00]">
          나만 보고 싶은 고민은{' '}
          <button onClick={() => navigate('/consult')} className="font-bold underline">
            1:1 유료 상담
          </button>
          으로 신청해 주세요.
        </p>
        <label className="mt-3 flex items-center gap-2 text-[13.5px] font-bold text-ink">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="h-4 w-4 accent-[#3182F6]"
          />
          위 내용을 확인했어요
        </label>
      </div>

      {error && <p className="px-1 text-[13px] text-danger">{error}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className={`h-[52px] w-full rounded-btn text-[16px] font-bold ${
          ready ? 'bg-brand text-white' : 'bg-brand/40 text-white'
        }`}
      >
        {busy ? '올리는 중…' : '질문 올리기'}
      </button>
    </div>
  )
}

// ── 질문과 답 ──────────────────────────────────

function QnaDetail({ id }: { id: string }) {
  const navigate = useNavigate()
  const staff = useStaff()
  const [data, setData] = useState<{ question: Question; answers: Answer[] } | null | undefined>(
    undefined,
  )
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () =>
    fetchQuestion(id)
      .then(setData)
      .catch(() => setData(null))
  useEffect(() => {
    void load()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (data === undefined)
    return <p className="py-10 text-center text-[13px] text-cap">불러오는 중…</p>
  if (data === null)
    return (
      <div className="space-y-3">
        <Back to="/qna" label="묻고 답하기" />
        <p className="rounded-card bg-white px-4 py-8 text-center text-[14px] text-sub shadow-card">
          아직 답이 달리지 않았거나 없는 질문이에요.
        </p>
      </div>
    )

  const { question: q, answers } = data
  const post = async () => {
    if (!draft.trim() || busy) return
    setBusy(true)
    try {
      await addAnswer(q.id, draft)
      setDraft('')
      await load()
    } catch {
      setMsg('답을 올리지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="animate-fade-up space-y-3">
      <div className="flex items-center justify-between">
        <Back to="/qna" label="묻고 답하기" />
        <button
          onClick={async () => {
            const r = await shareLink(qnaLink(q.id), `결영이네 묻고 답하기 · ${q.title}`)
            setMsg(r === 'copied' ? '링크를 복사했어요' : r === 'failed' ? qnaLink(q.id) : '')
          }}
          className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-bold text-sub shadow-card active:bg-line"
        >
          <Share2 size={14} /> 공유
        </button>
      </div>
      {msg && <p className="px-1 text-[12px] text-brand">{msg}</p>}

      <div className="rounded-card bg-white p-4 shadow-card">
        <div className="flex items-center gap-1.5">
          <CategoryBadge category={q.category} />
          <span className="text-[12px] text-cap">
            {q.mine ? '내 질문' : q.nickname} · {dateLabel(q.createdAt)}
          </span>
        </div>
        <h1 className="mt-2 text-[18px] font-bold leading-snug text-ink">{q.title}</h1>
        <p className="mt-2 whitespace-pre-wrap text-[14.5px] leading-relaxed text-sub">{q.body}</p>
        {(q.mine || staff) && (
          <div className="mt-3 flex justify-end gap-3 text-[12px] text-cap">
            {staff && (
              <button
                onClick={async () => {
                  await setQuestionHidden(q.id, !q.hidden)
                  await load()
                }}
                className="flex items-center gap-1"
              >
                <EyeOff size={13} /> {q.hidden ? '다시 보이기' : '숨기기'}
              </button>
            )}
            <button
              onClick={async () => {
                if (!confirm('이 질문을 지울까요?')) return
                await deleteQuestion(q.id)
                navigate('/qna', { replace: true })
              }}
              className="flex items-center gap-1"
            >
              <Trash2 size={13} /> 지우기
            </button>
          </div>
        )}
      </div>

      {answers.map((a) => (
        <div
          key={a.id}
          className="rounded-card border-[1.5px] border-brand/30 bg-white p-4 shadow-card"
        >
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-white">
              결
            </span>
            <span className="text-[14px] font-bold text-ink">{a.authorName} 답</span>
            <span className="text-[12px] text-cap">{dateLabel(a.createdAt)}</span>
            {staff && (
              <button
                onClick={async () => {
                  if (!confirm('이 답을 지울까요?')) return
                  await deleteAnswer(a.id)
                  await load()
                }}
                className="ml-auto text-cap"
                aria-label="답 지우기"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[14.5px] leading-relaxed text-ink">
            {a.body}
          </p>
        </div>
      ))}

      {answers.length === 0 && !staff && (
        <p className="rounded-card bg-white px-4 py-5 text-center text-[13px] text-sub shadow-card">
          결영이네가 읽고 답을 준비하고 있어요
        </p>
      )}

      {staff && (
        <div className="space-y-2 rounded-card bg-white p-4 shadow-card">
          <p className="text-[13px] font-bold text-sub">답 달기 (결영이네만 보여요)</p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            aria-label="답"
            placeholder="답을 적어 주세요"
            className="w-full resize-none rounded-btn border border-line px-3.5 py-3 text-[14.5px] leading-relaxed text-ink outline-none focus:border-brand"
          />
          <button
            onClick={post}
            disabled={busy || !draft.trim()}
            className="h-11 w-full rounded-btn bg-ink text-[14px] font-bold text-white disabled:opacity-40"
          >
            {busy ? '올리는 중…' : '답 올리기'}
          </button>
        </div>
      )}

      <div className="rounded-card bg-white p-4 shadow-card">
        <p className="text-[14px] font-bold text-ink">우리집 숫자로 자세히 보고 싶다면</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate('/consult')}
            className="rounded-btn bg-ink py-3 text-[13.5px] font-bold text-white"
          >
            1:1 상담 신청
          </button>
          <a
            href={ONETEAM_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-btn border border-line py-3 text-center text-[13.5px] font-bold text-ink"
          >
            원팀 프로젝트
          </a>
        </div>
      </div>

      <button
        onClick={() => navigate('/qna/new')}
        className="w-full rounded-card bg-brand/10 py-3.5 text-[14px] font-bold text-brand"
      >
        나도 질문하기
      </button>
    </div>
  )
}
