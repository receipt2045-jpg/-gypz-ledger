// ── 머니툰 자료 (2026-11-19) ──
// 머니그랩 인스타툰(「호랑이 눈높이 재테크」) 마지막 장에서 "댓글 남기면 보내줄게" 한 정리본.
// 한 편 = src/lib/moneytoon/<slug>.json 파일 하나. 파일만 더하면 moabuli.com/money/<slug> 가 생기고
// 자료 나눔 목록(/share)과 링크 미리보기(vite.config.ts)에도 저절로 들어간다.
// 파일은 서버 루틴(gyeolyoung-content routines/머니툰.md 4-1)이 만든다. 모양이 틀리면 moneytoon.test.ts 가 빌드를 막는다.
import type { ShareCategory, ShareItem } from './shares'

export type MtBlock =
  /** 체크 칸 — 폰에서 눌러 체크(그 폰에만 기억) */
  | { type: 'checklist'; title: string; items: string[] }
  /** 표 — rows 는 예시 줄, blank 만큼 직접 적는 빈 줄 */
  | {
      type: 'table'
      title: string
      head: string[]
      rows: string[][]
      blank?: number
      note?: string
    }
  /** 이렇게 판단해요 — label(굵게) + text */
  | { type: 'rules'; title: string; items: { label: string; text: string }[] }
  /** 한 줄 말 — by 가 있으면 "— by" (예: 머니그랩 생각) */
  | { type: 'note'; title: string; text: string; by?: string }
  /** 낱말 풀이 */
  | { type: 'words'; title: string; items: { word: string; mean: string }[] }
  /** 다른 자료로 가는 버튼 */
  | { type: 'link'; title: string; text: string; href: string }

export interface MoneyToon {
  /** 주소 moabuli.com/money/<slug> — 영어 소문자·숫자·- */
  slug: string
  /** 정리본 이름 (툰 마지막 장 CTA 그대로, 예: 산 이유 점검표) */
  title: string
  /** 툰 표지 질문 (예: 내 주식 하루 만에 14%↓ 이제 어떡해?) */
  episode: string
  /** 자료 나눔 분류 — 없으면 재테크 */
  category?: ShareCategory
  /** 'YYYY-MM-DD' 자료 만든 날 */
  date: string
  emoji: string
  /** 표지 아래 설명 한두 줄 */
  lead: string
  /** 링크 미리보기 설명 한 줄 */
  description: string
  /** 원고 카페 글 (예: https://cafe.naver.com/f-e/cafes/31360549/articles/1636) */
  source: string
  /** 원고 날짜 'YYYY-MM-DD' (지난 숫자면 "○월 ○일 기준") */
  sourceDate: string
  blocks: MtBlock[]
}

const files = import.meta.glob<{ default: MoneyToon }>('./moneytoon/*.json', { eager: true })

export const MONEYTOONS: MoneyToon[] = Object.values(files)
  .map((m) => m.default)
  .sort((a, b) => (a.date < b.date ? 1 : -1))

export const moneyToon = (slug: string | undefined) => MONEYTOONS.find((m) => m.slug === slug)

export const MONEYTOON_SHARES: ShareItem[] = MONEYTOONS.map((m) => ({
  slug: `money-${m.slug}`,
  path: `/money/${m.slug}`,
  title: m.title,
  sub: `머니툰 「${m.episode}」 정리본`,
  category: m.category ?? '재테크',
  date: m.date,
  minutes: 2,
  emoji: m.emoji,
  tint: 'bg-orange-50',
}))

const BLOCK_TYPES = ['checklist', 'table', 'rules', 'note', 'words', 'link']
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** 파일 모양 검사 — 틀린 곳을 글로 돌려준다(없으면 빈 배열) */
export function checkMoneyToon(m: MoneyToon): string[] {
  const bad: string[] = []
  const need = (ok: unknown, what: string) => {
    if (!ok) bad.push(`${m?.slug ?? '?'}: ${what}`)
  }
  need(
    typeof m.slug === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.slug),
    'slug 는 영어 소문자·숫자·-',
  )
  for (const k of ['title', 'episode', 'emoji', 'lead', 'description'] as const)
    need(typeof m[k] === 'string' && m[k].trim(), `${k} 가 비었어요`)
  need(DAY.test(m.date), 'date 는 YYYY-MM-DD')
  need(DAY.test(m.sourceDate), 'sourceDate 는 YYYY-MM-DD')
  need(/^https:\/\/cafe\.naver\.com\//.test(m.source), 'source 는 카페 글 주소')
  need(Array.isArray(m.blocks) && m.blocks.length > 0, 'blocks 가 비었어요')
  for (const [i, b] of (m.blocks ?? []).entries()) {
    const at = `blocks[${i}]`
    need(BLOCK_TYPES.includes(b?.type), `${at} type 은 ${BLOCK_TYPES.join('/')}`)
    need(typeof b?.title === 'string' && b.title.trim(), `${at} title 이 비었어요`)
    if (b.type === 'checklist')
      need(b.items?.length && b.items.every((x) => typeof x === 'string'), `${at} items`)
    if (b.type === 'table') {
      need(b.head?.length >= 2, `${at} head 는 2칸 이상`)
      need(
        Array.isArray(b.rows) && b.rows.every((r) => r.length === b.head.length),
        `${at} rows 칸 수가 head 와 같아야 해요`,
      )
    }
    if (b.type === 'rules')
      need(b.items?.length && b.items.every((x) => x.label && x.text), `${at} items 는 label·text`)
    if (b.type === 'note') need(typeof b.text === 'string' && b.text.trim(), `${at} text`)
    if (b.type === 'words')
      need(b.items?.length && b.items.every((x) => x.word && x.mean), `${at} items 는 word·mean`)
    if (b.type === 'link') need(/^(https:\/\/|\/)/.test(b.href ?? '') && b.text, `${at} href·text`)
  }
  return bad
}
