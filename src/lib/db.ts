import { supabase } from './supabase'
import type {
  AppData,
  AssetSnapshot,
  Categories,
  Confession,
  MonthlyLedger,
  OccasionEntry,
  Profile,
} from '../types'

// ── 멤버십 / 가구 ─────────────────────────────

export interface Membership {
  householdId: string
  memberNo: 1 | 2
}

export async function getMyMembership(): Promise<Membership | null> {
  // 배우자가 합류하면 가구 멤버가 2명이 되므로, 반드시 내 계정 행만 조회해야 함
  // (필터 없이 maybeSingle()을 쓰면 2행이 잡혀 에러가 남)
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return null
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id, member_no')
    .eq('user_id', uid)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { householdId: data.household_id, memberNo: data.member_no as 1 | 2 }
}

export async function createHousehold(): Promise<Membership> {
  const { data, error } = await supabase.rpc('create_household')
  if (error) throw error
  return { householdId: data.id, memberNo: 1 }
}

export async function joinHousehold(code: string): Promise<Membership> {
  const { data, error } = await supabase.rpc('join_household', { code })
  if (error) throw error
  return { householdId: data.id, memberNo: 2 }
}

// ── 전체 데이터 로드 ──────────────────────────

export interface HouseholdData extends AppData {
  inviteCode: string
}

export async function fetchHouseholdData(householdId: string): Promise<HouseholdData> {
  const [hh, lg, sn, oc] = await Promise.all([
    supabase.from('households').select('*').eq('id', householdId).single(),
    supabase.from('ledgers').select('*').eq('household_id', householdId).order('ym'),
    supabase.from('snapshots').select('*').eq('household_id', householdId).order('ym'),
    supabase.from('occasions').select('*').eq('household_id', householdId).order('date', { ascending: false }),
  ])
  const firstError = hh.error || lg.error || sn.error || oc.error
  if (firstError) throw firstError

  const h = hh.data
  const profile: Profile = {
    member1Name: h.member1_name,
    member2Name: h.member2_name,
    childNames: (h.child_names as string[] | null) ?? [],
    targetNetWorth: Number(h.target_net_worth),
    startYear: h.start_year,
  }
  const ledgers: MonthlyLedger[] = (lg.data ?? []).map((r) => ({
    ym: r.ym,
    items: r.items,
    closed: r.closed,
    settledMembers: r.settled_members,
  }))
  const snapshots: AssetSnapshot[] = (sn.data ?? []).map((r) => ({ ym: r.ym, items: r.items }))
  const occasions: OccasionEntry[] = (oc.data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    category: r.category,
    title: r.title,
    amount: Number(r.amount),
  }))

  return {
    profile,
    ledgers,
    snapshots,
    occasions,
    categories: h.categories as Categories,
    inviteCode: h.invite_code,
  }
}

// ── 저장 (각 스토어 액션과 1:1 대응) ──────────

export async function pushLedger(householdId: string, ledger: MonthlyLedger) {
  const { error } = await supabase.from('ledgers').upsert({
    household_id: householdId,
    ym: ledger.ym,
    items: ledger.items,
    closed: ledger.closed,
    settled_members: ledger.settledMembers ?? [],
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function pushSnapshot(householdId: string, snapshot: AssetSnapshot) {
  const { error } = await supabase.from('snapshots').upsert({
    household_id: householdId,
    ym: snapshot.ym,
    items: snapshot.items,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function pushOccasion(householdId: string, entry: OccasionEntry) {
  const { error } = await supabase.from('occasions').insert({
    id: entry.id,
    household_id: householdId,
    date: entry.date,
    category: entry.category,
    title: entry.title,
    amount: entry.amount,
  })
  if (error) throw error
}

export async function deleteOccasion(id: string) {
  const { error } = await supabase.from('occasions').delete().eq('id', id)
  if (error) throw error
}

export async function pushProfile(householdId: string, profile: Profile) {
  const { error } = await supabase
    .from('households')
    .update({
      member1_name: profile.member1Name,
      member2_name: profile.member2Name,
      child_names: profile.childNames ?? [],
      target_net_worth: profile.targetNetWorth,
      start_year: profile.startYear,
    })
    .eq('id', householdId)
  if (error) throw error
}

export async function pushCategories(householdId: string, categories: Categories) {
  const { error } = await supabase
    .from('households')
    .update({ categories })
    .eq('id', householdId)
  if (error) throw error
}

// ── 일일 고백 (confessions) ────────────────────

/** 최근 62일 고백 로그 (스트릭 계산 + 월 로그 표시용) */
export async function fetchConfessions(householdId: string): Promise<Confession[]> {
  const since = new Date()
  since.setDate(since.getDate() - 62)
  const { data, error } = await supabase
    .from('confessions')
    .select('*')
    .eq('household_id', householdId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    memberNo: r.member_no as 1 | 2,
    category: r.category,
    kind: r.kind,
    amount: Number(r.amount),
    note: r.note ?? undefined,
    createdAt: r.created_at,
  }))
}

export async function insertConfession(householdId: string, c: Confession) {
  const { error } = await supabase.from('confessions').insert({
    id: c.id,
    household_id: householdId,
    member_no: c.memberNo,
    category: c.category,
    kind: c.kind,
    amount: c.amount,
    note: c.note ?? null,
    created_at: c.createdAt,
  })
  if (error) throw error
}

/** 회원 탈퇴: 내 가구·모든 데이터 삭제 후 로그아웃 (RPC delete_my_account) */
export async function deleteMyAccount() {
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw error
}

/** 모든 기록 삭제 (가구/멤버십은 유지) */
export async function clearHouseholdRecords(householdId: string) {
  const results = await Promise.all([
    supabase.from('ledgers').delete().eq('household_id', householdId),
    supabase.from('snapshots').delete().eq('household_id', householdId),
    supabase.from('occasions').delete().eq('household_id', householdId),
  ])
  const err = results.find((r) => r.error)?.error
  if (err) throw err
}

/** JSON 가져오기: 기존 기록을 지우고 통째로 교체 */
export async function replaceAllData(householdId: string, data: AppData) {
  await clearHouseholdRecords(householdId)
  await Promise.all([
    pushProfile(householdId, data.profile),
    pushCategories(householdId, data.categories),
    ...data.ledgers.map((l) => pushLedger(householdId, l)),
    ...data.snapshots.map((s) => pushSnapshot(householdId, s)),
    ...data.occasions.map((o) => pushOccasion(householdId, o)),
  ])
}
