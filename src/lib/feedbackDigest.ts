import { supabase } from './supabase'

export interface FeedbackItem {
  rating: number | null
  message: string
  screen: string | null
  created_at: string
}

export interface FeedbackDigest {
  count: number
  avgRating: number | null
  items: FeedbackItem[]
}

/**
 * 운영자 전용 — 받은 의견 목록 (권한 확인은 서버에서).
 * feedback 테이블은 RLS로 앱에서 못 읽으므로 report-admin 함수를 거친다.
 * (예전엔 feedback-digest라는 AI 분석 함수를 불렀는데, 배포된 적이 없어
 *  이 화면이 늘 실패했다. 목록만 있으면 충분해서 단순화했다.)
 */
export async function requestFeedbackDigest(): Promise<FeedbackDigest> {
  const { data, error } = await supabase.functions.invoke('report-admin', {
    body: { action: 'feedback' },
  })
  if (error) throw new Error('서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')
  if (data?.error) throw new Error(data.error)
  return data as FeedbackDigest
}
