// ── 맞춤 추천 카드 (2026-10-24, 토스 '송금 후 배너' 벤치마킹) ──
// 일을 하나 끝낸 순간(소비 기록 저장 직후 · 월말 정산 완료)에 우리집 숫자에 맞는 카드 한 장.
// 지금은 우리 상품(계산기·원팀·상담)만 — 제휴 혜택이 생기면 같은 틀에 넣는다.
// 어느 자리에서 어떤 카드가 보이고 눌렸는지 reco_events에 남긴다(supabase/reco-events.sql).
import { supabase } from './supabase'
import { monthConfessions } from './confessLedger'
import { abbreviateKRW } from './format'
import { NO_SPEND } from './constants'
import type { BudgetItem, Confession } from '../types'

const ONETEAM_URL = 'https://oneteamm.netlify.app' // components/CalcShell과 같은 주소

export type RecoSlot = 'confess' | 'settle'

export interface RecoCard {
  id: string
  tag: string
  /** 줄바꿈(\n) 자리까지 그대로 보여준다 */
  title: string
  body: string
  cta: string
  /** 앱 안 주소 */
  to?: string
  /** 밖으로 나가는 주소 (새 창) */
  href?: string
  /** 카드 아래 작은 링크 하나 */
  sub?: { label: string; to: string }
}

const LEAVE: RecoCard = {
  id: 'leave',
  tag: '우리집 맞춤',
  title: '육아 지출이 생겼다면,\n휴직하면 매달 얼마 남을지 미리 봐요',
  body: '우리집 가계부 숫자로 바로 계산돼요',
  cta: '육아휴직 계산해 보기',
  to: '/leave',
}

const HOME_LOAN: RecoCard = {
  id: 'home-loan',
  tag: '우리집 맞춤',
  title: '집 생각 중이라면,\n우리 조건에 맞는 대출부터 찾아봐요',
  body: '신생아 특례·디딤돌·보금자리까지 한 번에 비교해요',
  cta: '내집마련 대출 찾기',
  to: '/calc/home-loan',
}

/** 방금 기록한 카테고리 → 카드 */
const BY_CATEGORY: Record<string, RecoCard> = { 육아: LEAVE, 주거: HOME_LOAN }

/**
 * 소비 기록 직후 카드 고르기 — 방금 적은 카테고리 맞춤 > 그 카테고리가 이번 달 예산을 넘었으면 원팀.
 * 맞는 게 없으면 null(안 띄운다). 오늘 이미 본 카드는 건너뛴다.
 */
export function pickConfessReco(
  savedCategories: string[],
  confessions: Confession[],
  items: Pick<BudgetItem, 'group' | 'category' | 'planned'>[],
  ym: string,
  seen: (id: string) => boolean = seenToday,
): RecoCard | null {
  const candidates: RecoCard[] = []
  for (const cat of savedCategories) {
    const card = BY_CATEGORY[cat]
    if (card && !candidates.includes(card)) candidates.push(card)
  }
  const month = monthConfessions(confessions, ym)
  for (const cat of savedCategories) {
    const planned = items
      .filter((it) => it.group === 'variable' && it.category === cat)
      .reduce((s, it) => s + it.planned, 0)
    if (planned <= 0) continue
    const spent = month
      .filter((c) => c.kind === 'variable' && c.category === cat && c.category !== NO_SPEND)
      .reduce((s, c) => s + c.amount, 0)
    if (spent > planned) {
      candidates.push({
        id: 'oneteam-over',
        tag: '결영이네 추천',
        title: `${cat} 예산을\n${abbreviateKRW(spent - planned)} 넘었어요`,
        body: '비슷한 고민을 하는 다른 부부들과 같이 줄여 봐요',
        cta: '원팀프로젝트 보러가기',
        href: ONETEAM_URL,
      })
      break
    }
  }
  return candidates.find((c) => !seen(c.id)) ?? null
}

/** 월말 정산을 마친 화면 — 남은 돈(모자란 돈)을 어디에 둘지 */
export function settleReco(surplus: number): RecoCard {
  const amount = abbreviateKRW(Math.abs(surplus))
  return {
    id: surplus >= 0 ? 'settle-surplus' : 'settle-deficit',
    tag: '결영이네 추천',
    title:
      surplus >= 0
        ? `남은 ${amount}, 어디에 둘지\n부부가 같이 정해 볼까요?`
        : `이번 달 ${amount} 모자랐어요.\n다음 달엔 어디서 줄일지 같이 정해요`,
    body: '비슷한 고민을 하는 다른 부부들과 함께 돈 공부해 봐요',
    cta: '원팀프로젝트 알아보기',
    href: ONETEAM_URL,
    sub: { label: '우리집 숫자로 1:1 상담 받기', to: '/consult' },
  }
}

// ── 같은 카드는 하루에 한 번 ──
const SEEN_KEY = 'moabuli.reco.seen'
const today = () => new Date().toLocaleDateString('sv-SE')

function readSeen(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

export function seenToday(id: string): boolean {
  return readSeen()[id] === today()
}

export function markSeen(id: string) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [id]: today() }))
  } catch {
    // 저장이 막힌 브라우저 — 같은 카드가 또 보일 뿐이다
  }
}

/** 보임·누름 기록 — 실패해도 화면엔 영향 없게 조용히 넘긴다 */
export function logReco(slot: RecoSlot, cardId: string, action: 'view' | 'click') {
  void (async () => {
    try {
      await supabase.from('reco_events').insert({ slot, card: cardId, action })
    } catch {
      // 기록용일 뿐이다
    }
  })()
}
