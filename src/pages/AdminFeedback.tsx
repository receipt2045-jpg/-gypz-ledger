import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, RefreshCw, Sparkles, Star } from 'lucide-react'
import Card from '../components/Card'
import { requestFeedbackDigest, type FeedbackDigest } from '../lib/feedbackDigest'

/** 운영자 전용 — 사용자 의견 모아보기 + AI 분석 (권한 검증은 Edge Function에서) */
export default function AdminFeedback() {
  const navigate = useNavigate()
  const [digest, setDigest] = useState<FeedbackDigest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setDigest(await requestFeedbackDigest())
    } catch (err) {
      setError(err instanceof Error ? err.message : '불러오지 못했어요.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="flex min-h-screen justify-center bg-[#e6e9ed]">
      <div className="relative flex min-h-screen w-full max-w-app flex-col bg-bg px-5 pb-16 shadow-[0_0_60px_rgba(0,0,0,0.06)]">
        <div className="sticky top-0 z-10 -mx-5 bg-bg px-5 pb-3 pt-4">
          <button
            onClick={() => navigate('/settings')}
            className="mb-2 text-ink active:opacity-60"
            aria-label="뒤로"
          >
            <ChevronLeft size={26} />
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-[22px] font-extrabold text-ink">받은 의견</h1>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1 rounded-full bg-brand/10 px-3 py-1.5 text-[12px] font-bold text-brand active:bg-brand/20 disabled:opacity-40"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              새로고침
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center py-16">
            <div className="mb-3 h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-brand" />
            <p className="text-[13.5px] text-sub">의견을 읽고 정리하는 중…</p>
            <p className="mt-1 text-[12px] text-cap">30초 정도 걸려요</p>
          </div>
        )}

        {error && (
          <Card className="mt-2">
            <p className="text-[14px] font-bold text-danger">{error}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-sub">
              운영자 계정으로 로그인했는지 확인해 주세요. 이 화면은 운영자만 볼 수 있어요.
            </p>
          </Card>
        )}

        {digest && !loading && (
          <div className="space-y-4">
            {/* 요약 지표 */}
            <div className="grid grid-cols-2 gap-2.5">
              <Card className="!p-4">
                <p className="text-[12px] text-cap">받은 의견</p>
                <p className="tnum mt-1 text-[24px] font-extrabold text-ink">{digest.count}건</p>
              </Card>
              <Card className="!p-4">
                <p className="text-[12px] text-cap">평균 별점</p>
                <p className="tnum mt-1 flex items-center gap-1 text-[24px] font-extrabold text-ink">
                  {digest.avgRating ?? '—'}
                  {digest.avgRating != null && (
                    <Star size={18} className="text-amber-400" fill="currentColor" />
                  )}
                </p>
              </Card>
            </div>

            {/* AI 분석 */}
            <Card>
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10">
                  <Sparkles size={14} className="text-brand" />
                </div>
                <p className="text-[14px] font-bold text-ink">AI 분석</p>
              </div>
              <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink">
                {digest.text}
              </p>
            </Card>

            {/* 원문 목록 */}
            {digest.items && digest.items.length > 0 && (
              <>
                <p className="px-1 pt-1 text-[13px] font-bold text-cap">원문 (최근 {digest.items.length}건)</p>
                <div className="space-y-2">
                  {digest.items.map((it, i) => (
                    <div key={i} className="rounded-card bg-card p-4 shadow-card">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-0.5">
                          {it.rating ? (
                            Array.from({ length: it.rating }).map((_, n) => (
                              <Star key={n} size={13} className="text-amber-400" fill="currentColor" />
                            ))
                          ) : (
                            <span className="text-[11px] text-cap">별점 없음</span>
                          )}
                        </span>
                        <span className="text-[11px] text-cap">
                          {new Date(it.created_at).toLocaleDateString('ko-KR')}
                          {it.screen ? ` · ${it.screen}` : ''}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-ink">
                        {it.message}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
