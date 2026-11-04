/**
 * 푸시 알림 보내는 규칙 (2026-11-04, 설계: docs/superpowers/specs/2026-11-04-push-notifications-design.md)
 *
 * "지금 누구에게 무엇을 보낼지"만 정한다. DB·FCM은 모른다.
 * push-dispatch(Deno), 앱(관리자 미리보기·동의 안내), vitest가 같이 쓴다 → Deno 전용 import 금지.
 * 모든 시각은 한국 시간(UTC+9, 서머타임 없음). getHours() 같은 로컬 시간대 함수는 쓰지 않는다.
 */

export type PushKind =
  | 'reminder'
  | 'settle'
  | 'settle_again'
  | 'news'
  | 'notice'
  | 'promo'
  | 'promo_reconfirm'

export interface PushPrefs {
  userId: string
  reminderOn: boolean
  /** 'HH:MM' 또는 DB 그대로 'HH:MM:SS' */
  reminderTime: string
  settleOn: boolean
  newsOn: boolean
  promoOn: boolean
  promoConsentAt: string | null
  promoReconfirmSentAt: string | null
}

export interface PushMember {
  householdId: string
  memberNo: 1 | 2
  /** households.month_start_day (1~28) */
  monthStartDay: number
}

export interface TodayPost {
  id: string
  kind: 'news' | 'market'
  title: string
  createdAt: string
}

export interface DueCampaign {
  id: string
  kind: 'notice' | 'promo'
  title: string
  body: string
  path: string
  sendAt: string
}

export interface PushInput {
  now: Date
  /** 토큰이 하나라도 있는 사람의 설정만 */
  prefs: PushPrefs[]
  /** userId → 집. 집이 없으면 리마인더·정산은 안 보낸다 */
  members: Record<string, PushMember>
  /** 오늘(KST) 기록이 있는 `${householdId}:${memberNo}` */
  confessedToday: Set<string>
  /** 정산을 마친(closed=true) `${householdId}:${ym}` */
  closedLedgers: Set<string>
  /** 오늘(KST) post_date인 news·market 글 */
  todayPosts: TodayPost[]
  /** status='scheduled'이고 send_at이 지난 캠페인 */
  campaigns: DueCampaign[]
  /** push_log에 이미 있는 logKey(userId, kind, refKey) */
  sentLog: Set<string>
}

export interface PlannedPush {
  userId: string
  kind: PushKind
  refKey: string
  title: string
  body: string
  path: string
  campaignId?: string
}

export interface PushPlan {
  sends: PlannedPush[]
  /** 이번 실행에서 마감할 캠페인(받을 사람이 0명이어도). 광고 시간 밖이면 빠진다 */
  campaignsDone: string[]
}

const KST_MS = 9 * 60 * 60 * 1000
const WINDOW_MS = 5 * 60 * 1000
const p2 = (n: number) => String(n).padStart(2, '0')

export const PROMO_PREFIX = '(광고) '
export const PROMO_FOOTER = '\n수신 거부: 설정 > 알림'

const FIXED = {
  reminder: { title: '오늘 기록할 시간이에요', body: '쓴 돈 30초면 남겨요.', path: '/confess' },
  settle: { title: '이번 달 정산할 날이에요', body: '한 달 돈 흐름, 같이 맞춰봐요.', path: '/monthly' },
  settle_again: { title: '정산이 아직이에요', body: '5분이면 끝나요.', path: '/monthly' },
} as const

export const logKey = (userId: string, kind: PushKind, refKey: string) => `${userId}|${kind}|${refKey}`

export interface KstParts {
  date: string
  ym: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

export function kstParts(now: Date): KstParts {
  const k = new Date(now.getTime() + KST_MS)
  const year = k.getUTCFullYear()
  const month = k.getUTCMonth() + 1
  const day = k.getUTCDate()
  return {
    year,
    month,
    day,
    hour: k.getUTCHours(),
    minute: k.getUTCMinutes(),
    ym: `${year}-${p2(month)}`,
    date: `${year}-${p2(month)}-${p2(day)}`,
  }
}

/** 한국 날짜 'YYYY-MM-DD'의 'HH:MM' → UTC ms */
export function kstInstant(date: string, hhmm: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = hhmm.split(':').map(Number)
  return Date.UTC(y, m - 1, d, hh, mm) - KST_MS
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`
}

/** src/lib/format.ts의 shiftYm과 같다 (Deno가 src를 못 읽어 따로 둔다) */
export function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const base = y * 12 + (m - 1) + delta
  return `${Math.floor(base / 12)}-${p2((base % 12) + 1)}`
}

/** 5분 창: now-5분 < target ≤ now. 창을 놓친 알림은 보내지 않는다(늦은 알림보다 안 보내는 게 낫다) */
export function inWindow(now: Date, target: number): boolean {
  const t = now.getTime()
  return t - WINDOW_MS < target && target <= t
}

/** 광고는 08:00~20:59에만 (정보통신망법: 21시~다음 날 8시 금지) */
export function promoHourOk(now: Date): boolean {
  const h = kstParts(now).hour
  return h >= 8 && h <= 20
}

export function promoText(title: string, body: string): { title: string; body: string } {
  return { title: PROMO_PREFIX + title, body: body + PROMO_FOOTER }
}

/** '2026년 11월 4일' (한국 날짜) */
export function koreanDate(iso: string): string {
  const k = kstParts(new Date(iso))
  return `${k.year}년 ${k.month}월 ${k.day}일`
}

/** 한국 달력으로 n달 뒤 같은 시각 (UTC ms) */
export function addMonthsKst(iso: string, months: number): number {
  const k = new Date(Date.parse(iso) + KST_MS)
  k.setUTCMonth(k.getUTCMonth() + months)
  return k.getTime() - KST_MS
}

/** format.ts setMonthStartDay와 같은 규칙: 1~28이 아니면 1 */
const startDayOf = (d: number) => (d >= 1 && d <= 28 ? Math.floor(d) : 1)

/**
 * 그날이 정산일이면 정산 대상 달, 아니면 null.
 * 시작일 d인 집은 매달 d일에 새 달이 시작되고(ymOfDate), 끝난 앞 달이 정산 대상이다.
 */
export function settleTargetOn(date: string, monthStartDay: number): string | null {
  if (Number(date.slice(8, 10)) !== startDayOf(monthStartDay)) return null
  return shiftYm(date.slice(0, 7), -1)
}

/** news를 market보다 먼저, 같은 종류면 먼저 올린 글 */
function pickNews(posts: TodayPost[]): TodayPost | null {
  const sorted = [...posts].sort((a, b) =>
    a.kind === b.kind ? a.createdAt.localeCompare(b.createdAt) : a.kind === 'news' ? -1 : 1,
  )
  return sorted[0] ?? null
}

export function planPushes(input: PushInput): PushPlan {
  const { now } = input
  const today = kstParts(now)
  const sends: PlannedPush[] = []
  const add = (p: PlannedPush) => {
    if (!input.sentLog.has(logKey(p.userId, p.kind, p.refKey))) sends.push(p)
  }

  const news = pickNews(input.todayPosts)
  const newsDue = inWindow(now, kstInstant(today.date, '08:00'))
  const settleDue = inWindow(now, kstInstant(today.date, '20:00'))
  const promoOk = promoHourOk(now)

  for (const pref of input.prefs) {
    const userId = pref.userId
    const m = input.members[userId]

    if (
      pref.reminderOn &&
      m &&
      inWindow(now, kstInstant(today.date, pref.reminderTime.slice(0, 5))) &&
      !input.confessedToday.has(`${m.householdId}:${m.memberNo}`)
    ) {
      add({ userId, kind: 'reminder', refKey: today.date, ...FIXED.reminder })
    }

    if (pref.settleOn && m && settleDue) {
      const ym = settleTargetOn(today.date, m.monthStartDay)
      if (ym && !input.closedLedgers.has(`${m.householdId}:${ym}`)) {
        add({ userId, kind: 'settle', refKey: `${ym}:settle`, ...FIXED.settle })
      }
      const ymAgain = settleTargetOn(shiftDate(today.date, -3), m.monthStartDay)
      if (
        ymAgain &&
        !input.closedLedgers.has(`${m.householdId}:${ymAgain}`) &&
        input.sentLog.has(logKey(userId, 'settle', `${ymAgain}:settle`))
      ) {
        add({ userId, kind: 'settle_again', refKey: `${ymAgain}:again`, ...FIXED.settle_again })
      }
    }

    if (pref.newsOn && news && newsDue) {
      add({ userId, kind: 'news', refKey: today.date, title: '오늘의 경제', body: news.title, path: `/info/${news.id}` })
    }

    if (pref.promoOn && pref.promoConsentAt && promoOk) {
      const base = Math.max(
        ...[pref.promoConsentAt, pref.promoReconfirmSentAt].filter((v): v is string => !!v).map(Date.parse),
      )
      if (now.getTime() >= addMonthsKst(new Date(base).toISOString(), 23)) {
        add({
          userId,
          kind: 'promo_reconfirm',
          refKey: `reconfirm:${today.ym}`,
          title: '소식·혜택 알림 수신 동의 안내',
          body: `${koreanDate(pref.promoConsentAt)}에 동의하셨어요. 계속 받으시려면 따로 하실 건 없어요. 그만 받으려면 설정 > 알림에서 꺼 주세요.`,
          path: '/settings',
        })
      }
    }
  }

  const campaignsDone: string[] = []
  for (const c of input.campaigns) {
    if (Date.parse(c.sendAt) > now.getTime()) continue
    if (c.kind === 'promo' && !promoOk) continue // 다음 08:00 실행으로 미룬다
    campaignsDone.push(c.id)
    const text = c.kind === 'promo' ? promoText(c.title, c.body) : { title: c.title, body: c.body }
    for (const pref of input.prefs) {
      if (c.kind === 'notice' ? !pref.newsOn : !pref.promoOn) continue
      add({ userId: pref.userId, kind: c.kind, refKey: `campaign:${c.id}`, ...text, path: c.path, campaignId: c.id })
    }
  }

  return { sends, campaignsDone }
}
