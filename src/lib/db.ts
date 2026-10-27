import { applyCategoryChanges, type CategoryChange } from './categoryChanges'
import { supabase } from './supabase'
import type { ChildRecord, GiftReport } from './childMoney'
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

/**
 * 배우자 가계부로 옮기기 — 혼자 쓰던 가계부는 지우고 초대 코드의 가계부에 들어간다 (supabase/switch-household.sql).
 * 둘이 쓰는 가계부면 서버가 거부한다.
 */
export async function switchHousehold(code: string): Promise<void> {
  const { error } = await supabase.rpc('switch_household', { code })
  if (error) throw error
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
    supabase
      .from('occasions')
      .select('*')
      .eq('household_id', householdId)
      .order('date', { ascending: false }),
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
    // 칸이 없는 옛 DB(마이그레이션 전)에서도 죽지 않게 — 없으면 '목표 넣기 전'으로 본다
    goal: (h.goal ?? undefined) as Profile['goal'],
    roadmap: (h.roadmap ?? undefined) as Profile['roadmap'],
    monthStartDay: h.month_start_day ?? undefined,
    // 아이 생일·매달 들어오는 돈 (2026-10-27, household-child-recurring.sql)
    childBirths: (h.child_births ?? undefined) as Profile['childBirths'],
    childRecurring: (h.child_recurring ?? undefined) as Profile['childRecurring'],
  }
  const ledgers: MonthlyLedger[] = (lg.data ?? []).map((r) => ({
    ym: r.ym,
    items: r.items,
    closed: r.closed,
    settledMembers: r.settled_members,
    contributions: r.contributions ?? undefined,
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
    aliases: (h.category_aliases as Record<string, string> | null) ?? {},
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
export async function fetchLedger(householdId: string, ym: string): Promise<MonthlyLedger | null> {
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
    contributions: data.contributions ?? undefined,
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
    // 공동통장 (2026-10-07) — 칸이 없는 옛 DB에서도 저장이 되게, 정한 달만 보낸다
    ...(ledger.contributions ? { contributions: ledger.contributions } : {}),
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

/** 한 달 통째로 지우기 — 가계부와 자산을 같이 지운다 */
export async function deleteMonth(householdId: string, ym: string) {
  const results = await Promise.all([
    supabase.from('ledgers').delete().eq('household_id', householdId).eq('ym', ym),
    supabase.from('snapshots').delete().eq('household_id', householdId).eq('ym', ym),
  ])
  const err = results.find((r) => r.error)?.error
  if (err) throw err
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
      // goal 칸은 household-goal.sql을 실행해야 생긴다. 칸이 없는 DB에 goal을 보내면
      // 이름·색·목표 순자산 저장까지 통째로 실패하므로, 목표를 세운 집만 보낸다.
      ...(profile.goal !== undefined ? { goal: profile.goal } : {}),
      // roadmap 칸도 같은 이유로 — household-roadmap.sql을 실행한 DB에서 로드맵을 만진 집만 보낸다
      ...(profile.roadmap !== undefined ? { roadmap: profile.roadmap } : {}),
      // 한 달 시작일 — month-start-day.sql을 실행한 DB에서, 바꾼 집만 보낸다 (없는 칸에 보내면 저장 전체가 실패)
      ...(profile.monthStartDay !== undefined ? { month_start_day: profile.monthStartDay } : {}),
      // 아이 생일·매달 들어오는 돈 — 정한 집만 보낸다
      ...(profile.childBirths !== undefined ? { child_births: profile.childBirths } : {}),
      ...(profile.childRecurring !== undefined ? { child_recurring: profile.childRecurring } : {}),
    })
    .eq('id', householdId)
  if (error) throw error
}

/** 서버에 있는 지금 카테고리 — 배우자·다른 기기에서 추가한 것까지 */
export async function fetchCategories(householdId: string): Promise<Categories> {
  const { data, error } = await supabase
    .from('households')
    .select('categories')
    .eq('id', householdId)
    .single()
  if (error) throw error
  return data.categories as Categories
}

/** 서버 최신 목록에 이 변경만 얹어 저장하고, 합쳐진 목록을 돌려준다 (lib/categoryChanges.ts) */
export async function changeCategories(
  householdId: string,
  changes: CategoryChange[],
): Promise<Categories> {
  const merged = applyCategoryChanges(await fetchCategories(householdId), changes)
  await pushCategories(householdId, merged)
  return merged
}

export async function pushCategories(householdId: string, categories: Categories) {
  const { error } = await supabase.from('households').update({ categories }).eq('id', householdId)
  if (error) throw error
}

// ── 일일 고백 (confessions) ────────────────────

/** 아이 앞으로 들어온 돈 전부 (2026-10-27) — 62일 밖까지. 자산 탭 아이 카드(올해 합계·10년 증여)용 */
export async function fetchChildRecords(householdId: string): Promise<ChildRecord[]> {
  const { data, error } = await supabase
    .from('confessions')
    .select('child, category, amount, child_keep, gift, created_at')
    .eq('household_id', householdId)
    .not('child', 'is', null)
  if (error) throw error
  return (data ?? []).map((r) => ({
    child: r.child,
    category: r.category,
    amount: Number(r.amount),
    childKeep: r.child_keep !== false,
    gift: r.gift === true,
    createdAt: r.created_at,
  }))
}

// ── 증여 신고 기록 (2026-10-27, supabase/child-gift-reports.sql) ──
export async function fetchGiftReports(householdId: string): Promise<GiftReport[]> {
  const { data, error } = await supabase
    .from('child_gift_reports')
    .select('id, child, reported_on, amount, kind, note')
    .eq('household_id', householdId)
    .order('reported_on', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    child: r.child,
    reportedOn: r.reported_on,
    amount: Number(r.amount),
    kind: r.kind,
    note: r.note ?? undefined,
  }))
}

export async function insertGiftReport(
  householdId: string,
  r: Omit<GiftReport, 'id'>,
): Promise<GiftReport> {
  const { data, error } = await supabase
    .from('child_gift_reports')
    .insert({
      household_id: householdId,
      child: r.child,
      reported_on: r.reportedOn,
      amount: r.amount,
      kind: r.kind,
      note: r.note ?? null,
    })
    .select('id')
    .single()
  if (error) throw error
  return { ...r, id: data.id }
}

export async function deleteGiftReport(id: string): Promise<void> {
  const { error } = await supabase.from('child_gift_reports').delete().eq('id', id)
  if (error) throw error
}

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
    cardOwner: (r.card_owner ?? undefined) as 1 | 2 | undefined,
    cash: r.paid_cash === true ? true : undefined,
    shared: r.shared === true ? true : undefined,
    child: r.child ?? undefined,
    childKeep: r.child ? r.child_keep !== false : undefined,
    gift: r.gift === true ? true : undefined,
    createdAt: r.created_at,
  }))
}

/**
 * 구성원 1·2 자리 바꾸기 — 이 가구의 모든 소비 기록(62일 밖까지)의 번호를 맞바꾼다 (lib/memberSwap).
 * 번호는 1·2만 허용이라 한 번에 바꿀 수 없어, 행마다 새 번호로 고친다.
 */
export async function swapConfessionMembers(householdId: string) {
  const { data, error } = await supabase
    .from('confessions')
    .select('id, member_no, card_owner')
    .eq('household_id', householdId)
  if (error) throw error
  const rows = data ?? []
  for (let i = 0; i < rows.length; i += 20) {
    const chunk = rows.slice(i, i + 20)
    const results = await Promise.all(
      chunk.map((r) =>
        supabase
          .from('confessions')
          .update({
            member_no: r.member_no === 1 ? 2 : 1,
            ...(r.card_owner ? { card_owner: r.card_owner === 1 ? 2 : 1 } : {}),
          })
          .eq('id', r.id),
      ),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) throw failed.error
  }
}

/** 고백 삭제 — RLS가 '내가 쓴 것'만 허용한다 (배우자 것은 서버가 거부) */
export async function deleteConfession(id: string) {
  const { error } = await supabase.from('confessions').delete().eq('id', id)
  if (error) throw error
}

/**
 * 기록 저장 — 새로 적기와 고치기를 한 길로 보낸다(id 기준 upsert).
 * 고치기도 같은 'confession' 큐 키를 쓰므로, 오프라인에서 적고 고치면
 * 큐에는 마지막 모습 하나만 남는다.
 */
export async function insertConfession(householdId: string, c: Confession) {
  const { error } = await supabase.from('confessions').upsert({
    id: c.id,
    household_id: householdId,
    member_no: c.memberNo,
    category: c.category,
    kind: c.kind,
    amount: c.amount,
    note: c.note ?? null,
    card_owner: c.cardOwner ?? null,
    // 공동·현금은 고치기(2026-10-27)에서 끌 수도 있어서 늘 보낸다 — upsert라 안 보내면 예전 값이 남는다.
    // (confession-shared.sql · confession-paid-cash.sql 칸은 운영 DB에 다 있다)
    paid_cash: !!c.cash,
    shared: !!c.shared,
    // 아이 앞으로 들어온 돈 (2026-10-27, confession-child.sql)
    child: c.child ?? null,
    child_keep: c.child ? c.childKeep !== false : null,
    gift: !!c.gift,
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
