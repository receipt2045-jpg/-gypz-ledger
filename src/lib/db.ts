import { supabase } from './supabase'
import type { PeerRow } from './peerBenchmark'
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

/** 우리집 구성원 수 (1이면 아직 혼자 쓰는 중) */
export async function fetchMemberCount(householdId: string): Promise<number> {
  const { count, error } = await supabase
    .from('household_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('household_id', householdId)
  if (error) throw error
  return count ?? 1
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
  aliases: Record<string, string> // 줄글 고백 학습 별칭 (단어 → 카테고리)
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
    member1Color: h.member1_color ?? undefined,
    member2Color: h.member2_color ?? undefined,
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
    // 줄글 고백 학습 별칭 (단어 → 카테고리, 가구 공유)
    aliases: ((h.category_aliases as Record<string, string> | null) ?? {}),
  }
}

/** 줄글 고백에서 학습한 별칭 저장 (가구 단위 — 부부가 함께 씀) */
export async function pushAliases(householdId: string, aliases: Record<string, string>) {
  const { error } = await supabase
    .from('households')
    .update({ category_aliases: aliases })
    .eq('id', householdId)
  if (error) throw error
}

/** 특정 월 가계부만 다시 읽기 — 정산 저장 직전, 배우자가 그사이 저장한 내용을 보존하기 위함 */
export async function fetchLedger(
  householdId: string,
  ym: string,
): Promise<MonthlyLedger | null> {
  const { data, error } = await supabase
    .from('ledgers')
    .select('*')
    .eq('household_id', householdId)
    .eq('ym', ym)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    ym: data.ym,
    items: data.items,
    closed: data.closed,
    settledMembers: data.settled_members,
  }
}

/** 특정 월 자산 스냅샷만 다시 읽기 — 저장 직전, 배우자가 그사이 추가한 자산을 보존하기 위함 */
export async function fetchSnapshot(
  householdId: string,
  ym: string,
): Promise<AssetSnapshot | null> {
  const { data, error } = await supabase
    .from('snapshots')
    .select('*')
    .eq('household_id', householdId)
    .eq('ym', ym)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return { ym: data.ym, items: data.items }
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
      member1_color: profile.member1Color ?? null,
      member2_color: profile.member2Color ?? null,
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

/** 고백 삭제 — RLS가 '내가 쓴 것'만 허용한다 (배우자 것은 서버가 거부) */
export async function deleteConfession(id: string) {
  const { error } = await supabase.from('confessions').delete().eq('id', id)
  if (error) throw error
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

// ── 맞춤 리포트 신청 ───────────────────────────
// 사람이 직접 가계부를 열어보는 서비스라, 신청과 열람 동의를 한 행에 남긴다.

export interface ReportRequest {
  id: string
  email: string
  contact?: string // 카톡 닉네임 (선택)
  note?: string
  consentAt: string
  revokedAt: string | null
  status: 'requested' | 'paid' | 'writing' | 'done' | 'canceled'
  paidAt: string | null
  createdAt: string
}

export async function fetchReportRequests(householdId: string): Promise<ReportRequest[]> {
  const { data, error } = await supabase
    .from('report_requests')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    email: r.email ?? r.contact ?? '',
    contact: r.contact ?? undefined,
    note: r.note ?? undefined,
    consentAt: r.consent_at,
    revokedAt: r.revoked_at,
    status: r.status,
    paidAt: r.paid_at ?? null,
    createdAt: r.created_at,
  }))
}

/** 신청 = 동의. 동의 없이 부르지 않는다(화면에서 체크를 강제). */
export async function insertReportRequest(
  householdId: string,
  input: { email: string; contact?: string; note?: string },
) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('로그인이 필요해요')
  const { error } = await supabase.from('report_requests').insert({
    household_id: householdId,
    user_id: auth.user.id,
    email: input.email,
    contact: input.contact ?? null,
    note: input.note ?? null,
    consent_at: new Date().toISOString(),
  })
  if (error) throw error
}

/** 열람 동의 철회 */
export async function revokeReportConsent(requestId: string) {
  const { error } = await supabase.rpc('revoke_report_consent', { request_id: requestId })
  if (error) throw error
}

// ── 사용자 의견 (feedback) ─────────────────────
// 운영자만 읽을 수 있고, 사용자는 자기 의견만 남길 수 있음(RLS).
export async function sendFeedback(input: {
  rating: number | null // 1~5 (선택)
  message: string
  screen?: string // 어느 화면에서 보냈는지
}) {
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase.from('feedback').insert({
    user_id: auth.user?.id ?? null,
    rating: input.rating,
    message: input.message,
    screen: input.screen ?? null,
    app_version: 'v1.0',
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
  // 서버 RPC가 고백까지 한 번에 지운다. 고백 삭제 정책은 '내 것만'이라
  // 클라이언트에서 지우면 배우자 고백이 남는다 — 그래서 security definer 함수를 쓴다.
  const { error } = await supabase.rpc('reset_household')
  if (!error) return
  // RPC가 아직 없으면(마이그레이션 전) 예전 방식으로 — 고백만 못 지운다
  if (error.code !== 'PGRST202' && error.code !== '42883') throw error
  const results = await Promise.all([
    supabase.from('ledgers').delete().eq('household_id', householdId),
    supabase.from('snapshots').delete().eq('household_id', householdId),
    supabase.from('occasions').delete().eq('household_id', householdId),
    supabase.from('confessions').delete().eq('household_id', householdId),
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

// ── 고정비 또래 비교 ───────────────────────────
// 서버가 분포만 계산해서 준다. 남의 금액은 넘어오지 않는다.
export async function fetchPeerBenchmark(): Promise<PeerRow[]> {
  const { data, error } = await supabase.rpc('fixed_cost_benchmark')
  if (error) throw error
  return (data ?? []) as PeerRow[]
}
