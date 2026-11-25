import { supabase } from './supabase'
import { getMyMembership } from './db'

/**
 * 가치관 체크리스트(#/values) 로그인 합치기 — supabase/household-values.sql.
 * 표가 아직 없거나 로그인 전이면 null 을 돌려주고, 화면은 링크 보내기 방식으로 돌아간다.
 */
export interface ValuesRow {
  userId: string
  role: 'w' | 'h'
  answers: string
}
export interface ValuesCloud {
  householdId: string
  userId: string
  rows: ValuesRow[]
}

export async function loadValuesCloud(): Promise<ValuesCloud | null> {
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) return null
  const m = await getMyMembership()
  if (!m) return null
  const rows = await fetchValuesRows(m.householdId)
  if (!rows) return null
  return { householdId: m.householdId, userId, rows }
}

export async function fetchValuesRows(householdId: string): Promise<ValuesRow[] | null> {
  const { data, error } = await supabase
    .from('household_values')
    .select('user_id, role, answers')
    .eq('household_id', householdId)
  if (error) return null // 표가 아직 없으면(마이그레이션 전) 링크 방식으로
  return (data ?? []).map((r) => ({
    userId: r.user_id as string,
    role: r.role as 'w' | 'h',
    answers: r.answers as string,
  }))
}

export async function saveMyValues(
  householdId: string,
  userId: string,
  role: 'w' | 'h',
  answers: string,
): Promise<boolean> {
  const { error } = await supabase.from('household_values').upsert({
    household_id: householdId,
    user_id: userId,
    role,
    answers,
    updated_at: new Date().toISOString(),
  })
  return !error
}

export async function deleteMyValues(householdId: string, userId: string): Promise<void> {
  await supabase.from('household_values').delete().eq('household_id', householdId).eq('user_id', userId)
}
