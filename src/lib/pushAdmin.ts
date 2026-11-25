/**
 * 관리자 > 알림 보내기 (2026-11-04, 푸시 2단계). 테이블: supabase/push.sql의 push_campaigns
 * 실제로 보내는 건 push-dispatch(5분마다). 여기서는 캠페인을 적어 두기만 한다.
 * 진짜 권한은 DB(RLS·RPC)가 막는다.
 */
import { supabase } from './supabase'
import { kstParts, promoHourOk, promoText } from '../../supabase/functions/_shared/pushRules.ts'
import { TIME_SLOTS } from './pushPrefs'

export { promoHourOk }

export type CampaignKind = 'notice' | 'promo'
export type CampaignStatus = 'scheduled' | 'sent' | 'canceled'

export interface Campaign {
  id: string
  kind: CampaignKind
  title: string
  body: string
  path: string
  sendAt: string
  status: CampaignStatus
  sentCount: number
  failCount: number
}

export interface CampaignDraft {
  kind: CampaignKind
  title: string
  body: string
  path: string
  sendAt: string
}

export const CAMPAIGN_KIND_LABEL: Record<CampaignKind, string> = { notice: '공지', promo: '홍보' }
export const STATUS_LABEL: Record<CampaignStatus, string> = { scheduled: '예약', sent: '보냄', canceled: '취소' }

/** 알림을 누르면 열릴 화면 (특정 글은 화면에서 최근 글 목록을 덧붙인다) */
export const PATH_OPTIONS: { label: string; path: string }[] = [
  { label: '홈', path: '/' },
  { label: '오늘의 경제', path: '/info' },
  { label: '상담 신청', path: '/consult' },
  { label: '묻고 답하기', path: '/qna' },
  { label: '월간 가계부', path: '/monthly' },
  { label: '소비 기록', path: '/confess' },
  { label: '설정', path: '/settings' },
]

export function previewText(kind: CampaignKind, title: string, body: string): { title: string; body: string } {
  return kind === 'promo' ? promoText(title, body) : { title, body }
}

/** 광고는 08:00~20:59 (예약 칸은 30분 단위라 08:00~20:30) */
export function promoTimeAllowed(hhmm: string): boolean {
  const h = Number(hhmm.slice(0, 2))
  return h >= 8 && h <= 20
}

export function timeSlotsFor(kind: CampaignKind): string[] {
  return kind === 'promo' ? TIME_SLOTS.filter(promoTimeAllowed) : TIME_SLOTS
}

/** 한국 날짜·시각 → ISO */
export function kstSendAt(date: string, hhmm: string): string {
  return new Date(`${date}T${hhmm}:00+09:00`).toISOString()
}

export function scheduleError(kind: CampaignKind, date: string, hhmm: string, now: Date): string | null {
  if (!date || !hhmm) return '날짜와 시각을 골라 주세요'
  if (kind === 'promo' && !promoTimeAllowed(hhmm)) return '광고 알림은 밤 9시부터 아침 8시까지 보낼 수 없어요'
  if (Date.parse(kstSendAt(date, hhmm)) <= now.getTime()) return '지난 시각은 고를 수 없어요'
  return null
}

/** '11/5 09:30' (한국 시간) */
export function sendAtLabel(iso: string): string {
  const k = kstParts(new Date(iso))
  return `${k.month}/${k.day} ${String(k.hour).padStart(2, '0')}:${String(k.minute).padStart(2, '0')}`
}

interface CampaignRow {
  id: string
  kind: CampaignKind
  title: string
  body: string
  path: string
  send_at: string
  status: CampaignStatus
  sent_count: number
  fail_count: number
}

export async function fetchCampaigns(limit = 20): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('push_campaigns')
    .select('id, kind, title, body, path, send_at, status, sent_count, fail_count')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as CampaignRow[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    path: r.path,
    sendAt: r.send_at,
    status: r.status,
    sentCount: r.sent_count,
    failCount: r.fail_count,
  }))
}

export async function createCampaign(d: CampaignDraft): Promise<void> {
  const { error } = await supabase
    .from('push_campaigns')
    .insert({ kind: d.kind, title: d.title, body: d.body, path: d.path, send_at: d.sendAt })
  if (error) throw error
}

export async function cancelCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from('push_campaigns')
    .update({ status: 'canceled' })
    .eq('id', id)
    .eq('status', 'scheduled')
  if (error) throw error
}

/** 받을 사람 수 (서버 함수 — 운영자만) */
export async function audienceCount(kind: CampaignKind): Promise<number> {
  const { data, error } = await supabase.rpc('push_audience_count', { p_kind: kind })
  if (error) throw error
  return Number(data ?? 0)
}
