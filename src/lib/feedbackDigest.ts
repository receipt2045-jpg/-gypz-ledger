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
  text: string
  items?: FeedbackItem[]
}

/** 운영자 전용 — 받은 의견을 AI로 분석 (권한 확인은 서버에서) */
export async function requestFeedbackDigest(): Promise<FeedbackDigest> {
  const { data, error } = await supabase.functions.invoke('feedback-digest', { body: {} })
  if (error) throw new Error('분석 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')
  if (data?.error) throw new Error(data.error)
  return data as FeedbackDigest
}
