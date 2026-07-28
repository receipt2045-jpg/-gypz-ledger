import { useState } from 'react'
import { Send, Star } from 'lucide-react'
import Card from './Card'
import { sendFeedback } from '../lib/db'

/**
 * 사용자 의견 보내기 — 별점(선택) + 한 마디.
 * 보낸 내용은 운영자만 볼 수 있고, 앱에서는 조회되지 않는다(RLS).
 */
export default function FeedbackCard({ screen }: { screen?: string }) {
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    const text = message.trim()
    if (!text || busy) return
    setBusy(true)
    setError('')
    try {
      await sendFeedback({ rating: rating || null, message: text, screen })
      setDone(true)
    } catch {
      setError('보내지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <Card>
        <h2 className="text-[15px] font-bold text-ink">의견 고맙습니다 🤍</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-sub">
          보내주신 이야기는 결영이네가 직접 읽어요. 다음 업데이트에 반영할게요.
        </p>
        <button
          onClick={() => {
            setDone(false)
            setRating(0)
            setMessage('')
          }}
          className="mt-3 text-[13px] font-semibold text-brand"
        >
          하나 더 보내기
        </button>
      </Card>
    )
  }

  return (
    <Card>
      <h2 className="text-[15px] font-bold text-ink">의견 보내기</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-sub">
        불편한 점, 있으면 좋겠는 기능 뭐든 좋아요. 결영이네가 직접 읽습니다.
      </p>

      {/* 별점 (선택) */}
      <div className="mt-3 flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(rating === n ? 0 : n)}
            aria-label={`별점 ${n}점`}
            className="active:scale-90"
          >
            <Star
              size={26}
              className={n <= rating ? 'text-amber-400' : 'text-line'}
              fill={n <= rating ? 'currentColor' : 'none'}
            />
          </button>
        ))}
        <span className="ml-1 text-[12px] text-cap">{rating > 0 ? `${rating}점` : '별점 (선택)'}</span>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="예: 정산할 때 카테고리를 더 쉽게 고르고 싶어요"
        className="mt-3 w-full resize-none rounded-btn border border-line bg-white px-3.5 py-3 text-[14px] leading-relaxed text-ink outline-none focus:border-brand placeholder:text-cap"
      />

      {error && <p className="mt-1.5 text-[13px] text-danger">{error}</p>}

      <button
        onClick={submit}
        disabled={!message.trim() || busy}
        className="mt-2 flex h-12 w-full items-center justify-center gap-1.5 rounded-btn bg-brand text-[15px] font-bold text-white active:bg-brand-dark disabled:opacity-40"
      >
        <Send size={16} />
        {busy ? '보내는 중…' : '보내기'}
      </button>
    </Card>
  )
}
