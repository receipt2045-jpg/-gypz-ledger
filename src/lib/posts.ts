import { supabase } from './supabase'

/**
 * 정보 탭 '오늘의 경제' — 결영이네가 매일 톡방에 올리는 글을 앱에도 쌓는다 (2026-10-05).
 *
 * 쓰는 사람은 운영자 한 명. 톡방에 올리는 글을 그대로 붙여넣으면
 * 첫 줄 "[결영이네] 10월 2일"에서 날짜, 둘째 줄 "오늘의 경제 뉴스"에서 제목·종류를 뽑는다.
 * 읽기는 로그인한 사람 모두, 쓰기는 운영자만 (supabase/posts.sql의 RLS).
 */

export const ADMIN_EMAIL = 'receipt2045@gmail.com'

export type PostKind = 'news' | 'market' | 'notice'

export const POST_KIND_LABEL: Record<PostKind, string> = {
  news: '경제 뉴스',
  market: '증시 정리',
  notice: '소식',
}

export interface Post {
  id: string
  kind: PostKind
  title: string
  body: string
  /** YYYY-MM-DD */
  postDate: string
  createdAt: string
}

export interface PostDraft {
  kind: PostKind
  title: string
  body: string
  postDate: string
}

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * 톡방 글을 그대로 붙여넣으면 날짜·제목·종류·본문으로 나눈다.
 *   [결영이네] 10월 2일      ← 날짜 (없으면 오늘)
 *   오늘의 경제 뉴스          ← 제목 ('증시'가 들어가면 증시 정리)
 *   (나머지 전부 본문)
 */
/**
 * 글 맨 앞이나 맨 끝에 붙인 짧은 부탁 한 줄("이렇게 바꿔서 올려", "올려줘")은 글이 아니다.
 * 2026-10-06 제보: 고친 글 끝의 "이렇게 바꿔서 올려"까지 앱에 올라갔다.
 */
const COMMAND_LINE = /^.{0,15}올려(줘|주세요)?[.!~ ]*$/

/** 부부방 글 끝에 중계가 붙이는 앱 링크 두 줄 — 카톡용이지 글 본문이 아니다 */
const APP_LINK = /\n*📱 지난 글은 모아불리[^\n]*(\n+https?:\/\/(www\.)?moabuli\.com\/news\S*)?/g

export function stripCommand(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').replace(APP_LINK, '').split('\n')
  const firstIdx = () => lines.findIndex((l) => l.trim())
  const lastIdx = () => {
    for (let i = lines.length - 1; i >= 0; i--) if (lines[i].trim()) return i
    return -1
  }
  const end = lastIdx()
  if (end >= 0 && COMMAND_LINE.test(lines[end].trim())) lines.splice(end, 1)
  const start = firstIdx()
  if (start >= 0 && COMMAND_LINE.test(lines[start].trim())) lines.splice(start, 1)
  return lines.join('\n').trim()
}

export function parsePasted(text: string, today: Date = new Date()): PostDraft {
  const lines = stripCommand(text).split('\n')
  const nonEmpty = () => {
    while (lines.length && !lines[0].trim()) lines.shift()
  }
  nonEmpty()

  let postDate = isoDate(today)
  // 날짜 줄: "[결영이네] 10월 2일" 또는 "10월 2일" (루틴 원문은 [결영이네] 없이 온다)
  const dateLine = lines[0]?.match(/^\s*(\[[^\]]*\]\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*$/)
  if (dateLine) {
    const m = Number(dateLine[2])
    const d = Number(dateLine[3])
    // 1월에 12월 글을 올리면 작년
    const year = m > today.getMonth() + 1 + 1 ? today.getFullYear() - 1 : today.getFullYear()
    postDate = `${year}-${pad(m)}-${pad(d)}`
    lines.shift()
    nonEmpty()
  }

  const title = (lines.shift() ?? '').trim() || '오늘의 경제'
  nonEmpty()
  const body = lines.join('\n').trim()
  const kind: PostKind = /증시|마감/.test(title) ? 'market' : 'news'
  return { kind, title, body, postDate }
}

export type Segment = { type: 'text'; text: string } | { type: 'link'; href: string }

/** 본문 속 기사 주소를 눌러지는 링크로 */
export function linkify(text: string): Segment[] {
  const out: Segment[] = []
  const re = /https?:\/\/[^\s<>"')\]]+/g
  let last = 0
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0
    if (i > last) out.push({ type: 'text', text: text.slice(last, i) })
    out.push({ type: 'link', href: m[0] })
    last = i + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) })
  return out
}

/** 톡방에도 보낼 글 — 붙여넣은 원문 그대로 + (원하면) 앱 링크 한 줄 */
export function kakaoText(original: string, withAppLink: boolean): string {
  const base = original.trim()
  return withAppLink
    ? `${base}\n\n📱 지난 글은 모아불리에서 모아 봐요\nhttps://moabuli.com/news`
    : base
}

/**
 * 지난 글 목록의 한 줄 — 🔰 다음 문단(그날의 한 줄 정리).
 * 카톡에서 옮긴 글은 문장 중간에 줄바꿈이 있어("오피스텔 평균 월세도⏎100만원에…") 빈 줄까지 이어 붙인다.
 * "부동산 2번 뉴스, 전세 매물이…"의 앞머리는 떼고, 🔰가 없는 9월 초 옛 형식은 본문 첫 줄을 쓴다.
 */
export function postSummary(body: string): string {
  const lines = body
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
  const mark = lines.findIndex((l) => l.startsWith('🔰'))
  if (mark >= 0) {
    const para: string[] = []
    for (const l of lines.slice(mark + 1)) {
      if (l) para.push(l)
      else if (para.length) break
    }
    const joined = para
      .join(' ')
      .replace(/\s*https?:\/\/\S+/g, '')
      .trim()
    if (joined) return joined.replace(/^\S+\s*\d+번\s*뉴스\s*,?\s*/, '').trim() || joined
  }
  const first = lines
    .map((l) =>
      l
        .replace(/https?:\/\/\S+/g, '')
        .replace(/^([-·■]|\d+\.)\s*/, '')
        .trim(),
    )
    .find((l) => l.length > 6)
  return first ?? ''
}

export interface MonthGroup {
  /** YYYY-MM */
  ym: string
  label: string
  posts: Post[]
}

/** 달별로 묶기 — 최근 달부터. 글 순서는 들어온 그대로(최근 글부터) */
export function groupByMonth(posts: Post[]): MonthGroup[] {
  const groups: MonthGroup[] = []
  for (const p of posts) {
    const ym = p.postDate.slice(0, 7)
    let g = groups.find((x) => x.ym === ym)
    if (!g) {
      const [y, m] = ym.split('-')
      g = { ym, label: `${y}년 ${Number(m)}월`, posts: [] }
      groups.push(g)
    }
    g.posts.push(p)
  }
  return groups.sort((a, b) => (a.ym < b.ym ? 1 : -1))
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

export interface DayGroup {
  /** YYYY-MM-DD */
  date: string
  /** 10월 6일 화요일 */
  label: string
  /** 그날 올린 순서대로(아침 → 저녁) */
  posts: Post[]
}

/** 날짜별로 묶기 — 최근 날부터. 같은 날 안에서는 올린 순서대로 읽게 한다 */
export function groupByDay(posts: Post[]): DayGroup[] {
  const days: DayGroup[] = []
  for (const p of posts) {
    let g = days.find((x) => x.date === p.postDate)
    if (!g) {
      const [y, m, d] = p.postDate.split('-').map(Number)
      const wd = WEEKDAY[new Date(y, m - 1, d).getDay()]
      g = { date: p.postDate, label: `${m}월 ${d}일 ${wd}요일`, posts: [] }
      days.push(g)
    }
    g.posts.push(p)
  }
  for (const g of days) g.posts.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  return days.sort((a, b) => (a.date < b.date ? 1 : -1))
}

// ── DB ────────────────────────────────────────

interface PostRow {
  id: string
  kind: PostKind
  title: string
  body: string
  post_date: string
  created_at: string
}

const fromRow = (r: PostRow): Post => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  body: r.body,
  postDate: r.post_date,
  createdAt: r.created_at,
})

export async function fetchPosts(limit = 20): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('post_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as PostRow[]).map(fromRow)
}

/** 지금까지 올린 글 수 — 정보 탭의 '지난 글 달별로 보기 N개' */
export async function fetchPostCount(): Promise<number> {
  const { count, error } = await supabase.from('posts').select('id', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

export async function insertPost(d: PostDraft): Promise<Post> {
  const { data, error } = await supabase
    .from('posts')
    .insert({ kind: d.kind, title: d.title, body: d.body, post_date: d.postDate })
    .select('*')
    .single()
  if (error) throw error
  return fromRow(data as PostRow)
}

export async function fetchPost(id: string): Promise<Post | null> {
  const { data, error } = await supabase.from('posts').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? fromRow(data as PostRow) : null
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) throw error
}

/** 지금 로그인한 사람이 운영자인지 — 화면에 버튼을 보일지만 정한다(진짜 막는 건 RLS) */
export async function amIAdmin(): Promise<boolean> {
  const { data } = await supabase.auth.getUser()
  return data.user?.email?.toLowerCase() === ADMIN_EMAIL
}
