import { supabase } from './supabase'
import type { HouseholdData, Benchmark } from './reportDraft'

/** 운영자 전용 — 리포트 신청 관리 (권한 확인은 Edge Function에서) */

export interface AdminRequest {
  id: string
  household_id: string
  householdName: string
  email: string | null
  contact: string | null
  note: string | null
  status: 'requested' | 'paid' | 'writing' | 'done' | 'canceled'
  consent_at: string
  revoked_at: string | null
  paid_at: string | null
  sent_at: string | null
  created_at: string
  hasDraft: boolean
}

export interface AdminHouseholdData extends HouseholdData {
  benchmark: Benchmark
  draft: string | null
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('report-admin', { body })
  if (error) throw new Error('서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')
  if (data?.error) throw new Error(data.error)
  return data as T
}

export async function listRequests(): Promise<AdminRequest[]> {
  const { requests } = await call<{ requests: AdminRequest[] }>({ action: 'list' })
  return requests
}

export async function loadHousehold(requestId: string): Promise<AdminHouseholdData> {
  return call<AdminHouseholdData>({ action: 'data', requestId })
}

export async function saveDraft(requestId: string, draft: string): Promise<void> {
  await call({ action: 'save', requestId, draft })
}

export async function markStatus(
  requestId: string,
  status: AdminRequest['status'],
): Promise<void> {
  await call({ action: 'mark', requestId, status })
}

/**
 * 초안을 결영 말투로 다듬는다 (AI).
 * 가계부 원본은 보내지 않는다 — 이미 계산된 초안 텍스트만 넘긴다.
 */
export async function aiRewriteDraft(draft: string, note?: string): Promise<string> {
  const r = await call<{ draft: string }>({ action: 'ai-rewrite', draft, note })
  return r.draft
}
