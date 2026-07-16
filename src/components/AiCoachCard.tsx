import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { requestDiagnosis, type CheckupSummary } from '../lib/aiCoach'

/**
 * 정산 완료 화면의 AI 진단 카드 (브리프 P3 4.1·4.3)
 * - 표기: "결영이네가 만든 AI 코치 😉" (AI인데 사람인 척 금지)
 * - 신뢰 메시지·면책 문구 노출, 최초 1회 사용 동의(계정 플래그) 후 진단
 */
export default function AiCoachCard({ summary }: { summary: CheckupSummary }) {
  const [consented, setConsented] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [diagnosis, setDiagnosis] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setConsented(!!data.user?.user_metadata?.aiCoachConsent)
    })
  }, [])

  const run = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    if (!consented) {
      // 사용 동의는 계정에 1회 저장 (브리프 4.3)
      supabase.auth.updateUser({ data: { aiCoachConsent: true } }).catch(console.error)
      setConsented(true)
    }
    try {
      setDiagnosis(await requestDiagnosis(summary))
    } catch (err) {
      setError(err instanceof Error ? err.message : '진단에 실패했어요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 w-full rounded-card bg-card p-5 text-left shadow-card">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10">
          <Sparkles size={16} className="text-brand" />
        </div>
        <p className="text-[14px] font-bold text-ink">결영이네가 만든 AI 코치 😉</p>
      </div>

      {diagnosis ? (
        <>
          <p className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-ink">
            {diagnosis}
          </p>
          <p className="mt-3 text-[12px] text-cap">
            데이터가 더 모이면 다른 부부와 비교해서 보여드릴게요 🤍
          </p>
          <p className="mt-1 text-[11px] text-cap">참고용 정보이며, 투자·재무 자문은 아닙니다.</p>
        </>
      ) : (
        <>
          <p className="mt-2.5 text-[13px] leading-relaxed text-sub">
            계좌는 연결하지 않습니다
            <br />
            입력한 내용만 안전하게 분석해요 🤍
          </p>
          <button
            onClick={run}
            disabled={loading || consented === null}
            className="mt-3 h-12 w-full rounded-btn bg-brand text-[15px] font-bold text-white active:bg-brand-dark disabled:opacity-50"
          >
            {loading
              ? '결영이네 관점으로 살펴보는 중…'
              : consented
                ? 'AI 진단 받기'
                : '동의하고 진단 받기'}
          </button>
          {consented === false && (
            <p className="mt-2 text-[11px] leading-relaxed text-cap">
              이번 정산 요약(금액 집계)을 AI 분석에 사용하는 데 동의하게 됩니다. 동의는 최초
              1회만 받아요.
            </p>
          )}
          {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
          <p className="mt-2 text-[11px] text-cap">참고용 정보이며, 투자·재무 자문은 아닙니다.</p>
        </>
      )}
    </div>
  )
}
