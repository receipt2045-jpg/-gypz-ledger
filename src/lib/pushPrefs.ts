/**
 * 알림 설정·토큰을 DB에 두는 곳 (2026-11-04, 푸시 2단계). 테이블: supabase/push.sql
 * 화면은 이 함수들만 부른다. 폰(Capacitor) 쪽은 pushNative.ts.
 */
import { supabase } from './supabase'
import { koreanDate } from '../../supabase/functions/_shared/pushRules.ts'

export interface NotificationPrefs {
  reminderOn: boolean
  /** 'HH:MM' */
  reminderTime: string
  settleOn: boolean
  newsOn: boolean
  promoOn: boolean
  promoConsentAt: string | null
}

export type PrefsPatch = Partial<Pick<NotificationPrefs, 'reminderOn' | 'reminderTime' | 'settleOn' | 'newsOn'>>

export const DEFAULT_REMINDER_TIME = '21:00'

/** 리마인더 시각 — 30분 단위 (DB check와 같다) */
export const TIME_SLOTS: string[] = Array.from(
  { length: 48 },
  (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`,
)

/** 'HH:MM' → "밤 9시", "오후 2시 30분" (0–5 밤, 6–10 아침, 11 오전, 12 낮, 13–17 오후, 18–20 저녁, 21–23 밤) */
export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const word = h <= 5 ? '밤' : h <= 10 ? '아침' : h === 11 ? '오전' : h === 12 ? '낮' : h <= 17 ? '오후' : h <= 20 ? '저녁' : '밤'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${word} ${h12}시${m ? ` ${m}분` : ''}`
}

// ── 처음 안내: [나중에]·권한 거부면 7일 동안 다시 안 띄운다 ──
const ASKED_KEY = 'pushAskedAt'
const ASK_AGAIN_MS = 7 * 24 * 60 * 60 * 1000

export function shouldAskPush(askedAt: string | null, now: Date): boolean {
  if (!askedAt) return true
  const t = Date.parse(askedAt)
  return Number.isNaN(t) || now.getTime() - t >= ASK_AGAIN_MS
}

export function readAskedAt(): string | null {
  try {
    return localStorage.getItem(ASKED_KEY)
  } catch {
    return null
  }
}

export function markAsked(now: Date): void {
  try {
    localStorage.setItem(ASKED_KEY, now.toISOString())
  } catch {
    // 시크릿 모드 등 — 다음에 또 물어도 괜찮다
  }
}

// ── 광고 알림 동의·철회 처리 결과 안내 (정보통신망법 제50조) ──
export function consentNotice(on: boolean, at: Date): string {
  return `${koreanDate(at.toISOString())} 수신 ${on ? '동의' : '거부'}가 처리됐어요`
}

export function firstConsentText(at: Date): string {
  return `${koreanDate(at.toISOString()).replace(/^\d+년 /, '')} 소식·혜택 알림 수신에 동의하셨어요`
}

// ── DB ──
async function myId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  const uid = data.user?.id
  if (!uid) throw new Error('로그인이 필요해요')
  return uid
}

interface PrefsRow {
  reminder_on: boolean
  reminder_time: string
  settle_on: boolean
  news_on: boolean
  promo_on: boolean
  promo_consent_at: string | null
}

const fromRow = (r: PrefsRow): NotificationPrefs => ({
  reminderOn: r.reminder_on,
  reminderTime: String(r.reminder_time).slice(0, 5),
  settleOn: r.settle_on,
  newsOn: r.news_on,
  promoOn: r.promo_on,
  promoConsentAt: r.promo_consent_at,
})

/** 내 알림 설정. 없으면 null(아직 알림을 켜지 않은 사람) */
export async function fetchPrefs(): Promise<NotificationPrefs | null> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return null
  const { data, error } = await supabase
    .from('notification_prefs')
    .select('reminder_on, reminder_time, settle_on, news_on, promo_on, promo_consent_at')
    .eq('user_id', uid)
    .maybeSingle()
  if (error) throw error
  return data ? fromRow(data as PrefsRow) : null
}

/**
 * 처음 알림을 켤 때 — 기본값으로 만든다. 광고는 체크했을 때만(동의 시각은 서버 트리거가 찍는다).
 * 이미 행이 있으면(앞서 읽기가 실패했던 경우 등) 덮어쓰지 않고, 저장된 값을 다시 읽어 돌려준다.
 */
export async function createPrefs(promo: boolean, now: Date): Promise<NotificationPrefs> {
  const uid = await myId()
  const { error } = await supabase.from('notification_prefs').upsert(
    {
      user_id: uid,
      reminder_on: true,
      reminder_time: DEFAULT_REMINDER_TIME,
      settle_on: true,
      news_on: true,
      promo_on: promo,
      promo_consent_at: promo ? now.toISOString() : null,
      promo_reconfirm_sent_at: null,
      updated_at: now.toISOString(),
    },
    { onConflict: 'user_id', ignoreDuplicates: true },
  )
  if (error) throw error
  const stored = await fetchPrefs()
  if (!stored) throw new Error('알림 설정을 저장하지 못했어요')
  return stored
}

export async function updatePrefs(patch: PrefsPatch): Promise<void> {
  const uid = await myId()
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.reminderOn !== undefined) row.reminder_on = patch.reminderOn
  if (patch.reminderTime !== undefined) row.reminder_time = patch.reminderTime
  if (patch.settleOn !== undefined) row.settle_on = patch.settleOn
  if (patch.newsOn !== undefined) row.news_on = patch.newsOn
  const { error } = await supabase.from('notification_prefs').update(row).eq('user_id', uid)
  if (error) throw error
}

/** 광고 알림 켜기·끄기. 켤 때마다 동의 시각을 새로 남긴다(2년 재확인 기준일) */
export async function setPromo(on: boolean, now: Date): Promise<void> {
  const uid = await myId()
  const row = on
    ? { promo_on: true, promo_consent_at: now.toISOString(), promo_reconfirm_sent_at: null, updated_at: now.toISOString() }
    : { promo_on: false, updated_at: now.toISOString() }
  const { error } = await supabase.from('notification_prefs').update(row).eq('user_id', uid)
  if (error) throw error
}

export async function registerToken(token: string): Promise<void> {
  const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: 'android' })
  if (error) throw error
}

/**
 * 회원 탈퇴 때 서버의 푸시 데이터(토큰·알림 설정·보낸 기록)를 지운다.
 * 웹에서 탈퇴해도 폰에 남은 토큰이 있을 수 있어 앱 여부와 상관없이 부른다. 여러 번 불러도 괜찮다.
 */
export async function deleteMyPushData(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_push_data')
  if (error) throw error
}

export async function forgetToken(token: string): Promise<void> {
  const { error } = await supabase.rpc('forget_push_token', { p_token: token })
  if (error) throw error
}
