// ============================================================
// 일일 고백 반응 엔진 (원팀가계부)
//
// 말투 규칙 (결영이네):
//   - 대구·잠언체 금지. "A는 ~한데 B는 ~다" 구조를 쓰지 않는다.
//   - 이모지는 거의 안 쓴다. 칭찬하는 자리에만 가끔 하나.
//   - 짧게. 한 줄에 한 가지만.
//   - 겁주지 않는다. 먼저 겪어본 사람이 옆에서 말해주는 톤.
//   - 모아·불리 둘 다 해요체. 반말·훈수·평가("걸린 거야", "웬일이야")는 쓰지 않는다 (2026-11-28 문구 검수).
//   - 숫자는 실제로 맞는 것만. 한 번 쓴 돈을 10년 곱해서 들이대지 않는다.
//
// 캐릭터: 모아(눈치채고 짚어줌) → 불리(그래서 얼마 남는지 계산해줌)
// 치환: {금액}{카테고리}{n}{월합}{연}{10년}
// ============================================================
import { currentYm } from './format'
import { ymOfIso } from './confessLedger'
import type { CategoryGroup, Confession } from '../types'
import { abbreviateKRW, formatWon } from './format'
import { NO_SPEND } from './constants'

// ── 3분법 버킷 ────────────────────────────────
export type Bucket = 'reduce' | 'protect' | 'leverage' | 'grow' | 'income' | 'neutral'
type ReduceSub =
  | 'sub'
  | 'telecom'
  | 'delivery'
  | 'cafe'
  | 'taxi'
  | 'shopping'
  | 'food'
  | 'beauty'
  | 'travel'
  | 'car'
  | 'culture'
  | 'pet'
  | 'booze'

const PROTECT = new Set(['용돈', '자기계발', '경조사', '육아'])
const LEVERAGE = new Set(['주거'])

/** reduce(줄일 여지가 있는 지출) 세부 분류 — 사용자 커스텀 카테고리도 키워드로 잡는다 */
function reduceSub(kind: CategoryGroup, category: string): ReduceSub | null {
  if (kind === 'income' || kind === 'saving' || kind === 'investment') return null
  const c = category
  if (c.includes('구독') || c.includes('OTT') || c.includes('넷플')) return 'sub'
  if (c.includes('통신') || c.includes('폰')) return 'telecom'
  if (c.includes('배달') || c.includes('외식')) return 'delivery'
  if (c.includes('카페') || c.includes('커피')) return 'cafe'
  if (c.includes('택시')) return 'taxi'
  if (
    c.includes('꾸밈') ||
    c.includes('미용') ||
    c.includes('화장') ||
    c.includes('네일') ||
    c.includes('헤어')
  )
    return 'beauty'
  if (c.includes('여행') || c.includes('항공') || c.includes('숙박') || c.includes('호텔'))
    return 'travel'
  if (c.includes('자동차') || c.includes('주유') || c.includes('기름') || c.includes('주차'))
    return 'car'
  if (
    c.includes('문화') ||
    c.includes('공연') ||
    c.includes('영화') ||
    c.includes('게임') ||
    c.includes('전시') ||
    c.includes('콘서트')
  )
    return 'culture'
  if (
    c.includes('반려') ||
    c.includes('강아지') ||
    c.includes('고양이') ||
    c.includes('댕댕') ||
    c.includes('냥')
  )
    return 'pet'
  if (
    c.includes('술') ||
    c.includes('유흥') ||
    c.includes('음주') ||
    c.includes('맥주') ||
    c.includes('소주') ||
    c.includes('와인') ||
    c.includes('회식') ||
    c.includes('파티')
  )
    return 'booze'
  if (c.includes('쇼핑') || c.includes('충동')) return 'shopping'
  if (c.includes('식비') || c.includes('식사')) return 'food'
  return null
}

function isDate(category: string): boolean {
  return category.includes('데이트')
}

export function bucketOf(kind: CategoryGroup, category: string): Bucket {
  if (kind === 'income') return 'income'
  if (kind === 'saving' || kind === 'investment') return 'grow'
  if (reduceSub(kind, category)) return 'reduce'
  if (PROTECT.has(category) || isDate(category)) return 'protect'
  if (LEVERAGE.has(category)) return 'leverage'
  return 'neutral'
}

// ── 반응 타입 ─────────────────────────────────
export interface Bubble {
  who: '모아' | '불리'
  text: string
}
export interface Reaction {
  bubbles: Bubble[]
  action?: string
  style?: 'tikitaka' | 'unit'
}

type Line = { who: '모아' | '불리'; text: string }

// ── 모아: 짚어주는 말 ─────────────────────────
// 2026-11-28 문구 검수 반영: 반말·훈수·평가를 빼고 해요체로, 그날 숫자와 대안 하나만 말한다.
// 매달 반복되는 지출(구독·통신)만 '1년이면' 같은 환산을 쓴다.
const ROAST: Record<ReduceSub, string[]> = {
  sub: [
    '이번 달 구독 {n}번째예요',
    '구독 {금액} 기록했어요',
    '이번 달 구독에 {월합} 나갔어요',
    '해지하지 않으면 다음 달에도 같이 나가요',
    '안 보는 구독이 있는지 한 번 확인해 보세요',
    '결제일과 마지막으로 본 날을 같이 적어 두면 편해요',
  ],
  delivery: [
    '이번 달 배달 {n}번째예요',
    '배달 {금액}. 배달비만 따로 세어 봐도 꽤 돼요',
    '이번 달 배달에 {월합} 나갔어요',
    '냉장고에 남은 재료부터 확인해 보세요',
    '이번 달 배달 {n}번, 합계 {월합}이에요',
    '배달이 잦은 요일을 보면 줄일 곳이 보여요',
  ],
  cafe: [
    '이번 달 카페 {n}번째예요',
    '카페 {금액}. 한 잔씩이어도 모이면 커져요',
    '이번 달 카페에 {월합} 썼어요',
    '이번 달 카페 {n}번, 합계 {월합}이에요',
    '집에서 내려 마시는 날을 정해 두면 편해요',
    '한 달 한도를 정해 두면 편해요',
  ],
  taxi: [
    '택시 {금액} 기록했어요',
    '이번 달 택시에 {월합} 썼어요',
    '10분 일찍 나오면 아낄 수 있어요',
    '한두 번은 괜찮아요. 습관이 되면 커져요',
    '이번 달 택시 {n}번째예요',
  ],
  shopping: [
    '이번 달 쇼핑 {n}번째예요',
    '쇼핑 {금액}. 필요한 물건이었는지 한 번 더 봐 주세요',
    '이번 달 쇼핑에 {월합} 나갔어요',
    '장바구니에 하루 두고 봐도 늦지 않아요',
    '다음 달 카드값에 {금액}이 잡혀요',
    '할인이라 산 거라면 다음엔 하루 기다려 보세요',
  ],
  telecom: [
    '통신비 {금액}. 요금제를 바꾼 지 오래됐다면 비교해 보세요',
    '약정이 끝났으면 알뜰폰 요금과 비교해 보세요',
    '이번 달 통신비 {월합}. 알뜰폰이면 절반 가까이 줄어요',
    '한 번 바꿔 두면 매달 그만큼 남아요',
  ],
  food: [
    '이번 달 식비 {n}번째예요',
    '식비 {금액} 기록했어요',
    '이번 달 식비가 {월합}이에요',
    '마지막으로 장 본 날을 확인해 보세요',
    '한 끼만 집밥으로 바꿔도 차이가 나요',
    '외식이 매일이면 금방 커져요',
  ],
  beauty: [
    '꾸밈비 {금액} 기록했어요',
    '이번 달 꾸밈비 {월합}이에요',
    '예산 안에서 쓰면 마음도 편해요',
    '이번 달 꾸밈비 {n}번째예요',
    '줄일 필요는 없어요. 한도만 정해 두세요',
  ],
  travel: [
    '여행 {금액} 기록했어요',
    '이번 달 여행에 {월합} 썼어요',
    '여행비를 미리 모아 두면 덜 부담돼요',
    '다음 여행은 여행 통장부터 만들어 두세요',
    '카드값은 다음 달에 나와요',
  ],
  car: [
    '차 유지비 {금액} 기록했어요',
    '이번 달 차에 {월합}이 나갔어요',
    '기름값·주차비는 매달 꾸준히 나가요',
    '차는 세워 둬도 유지비가 나가요',
    '이번 달 차 {n}번째예요',
  ],
  culture: [
    '문화비 {금액} 기록했어요',
    '이번 달 문화비 {월합}이에요',
    '이번 달 {n}번째예요. 다음 건 다음 달로 미뤄도 돼요',
    '예산을 정해 두면 마음 놓고 즐겨도 돼요',
  ],
  pet: [
    '반려 지출 {금액} 기록했어요',
    '이번 달 반려비 {월합}이에요',
    '병원비는 갑자기 오니 따로 모아 두세요',
    '줄일 필요는 없어요. 예산만 잡아 두세요',
  ],
  booze: [
    '술값 {금액} 기록했어요',
    '이번 달 술자리에 {월합} 썼어요',
    '이번 달 술자리 {n}번째예요',
    '이번 달은 술자리가 많은 편이에요',
    '모임이 많은 달은 한도를 정해 두면 편해요',
  ],
}

// ── 불리: 그래서 얼마가 남는지 ────────────────
// '{연}'은 이 페이스가 1년 이어졌을 때. 반드시 '이 페이스면'을 붙여 쓴다.
const UPSIDE: Record<ReduceSub | 'default', string[]> = {
  sub: [
    '이 페이스면 1년에 {연}이에요',
    '구독 하나만 정리해도 매달 그만큼 남아요',
    '정리한 만큼 적금으로 옮기면 종잣돈이 돼요',
  ],
  delivery: [
    '이 페이스면 1년에 {연}이에요',
    '한 달만 반으로 줄여도 꽤 남아요',
    '줄인 만큼은 적금으로 옮겨 두세요',
  ],
  cafe: [
    '이 페이스면 1년에 {연}이에요',
    '주 이틀만 집에서 마셔도 차이가 나요',
    '아낀 만큼은 자동이체로 빼 두세요',
  ],
  taxi: [
    '이 페이스면 1년에 {연}이에요',
    '걷는 날을 하루 늘리면 그만큼 남아요',
    '남는 돈은 비상금 통장으로 옮겨 두세요',
  ],
  shopping: [
    '이 페이스면 1년에 {연}이에요',
    '지금 참으면 정말 갖고 싶던 걸 살 수 있어요',
    '하루 지나도 사고 싶으면 그때 사도 돼요',
  ],
  telecom: [
    '요금제만 바꿔도 1년이면 {연} 근처예요',
    '한 번 바꿔 두면 신경 쓰지 않아도 매달 남아요',
    '줄인 금액만큼 적금 자동이체를 걸어 두세요',
  ],
  food: [
    '이 페이스면 1년에 {연}이에요',
    '한 주에 두 끼만 집밥으로 바꿔도 남아요',
    '장 보는 날을 정해 두면 훨씬 덜 나가요',
  ],
  beauty: [
    '이 페이스면 1년에 {연}이에요',
    '월 한도만 정해 두면 편하게 써도 돼요',
    '남는 돈은 따로 빼 두면 다음에 편해요',
  ],
  travel: [
    '여행 통장을 따로 모으면 다녀와서 덜 부담돼요',
    '매달 조금씩 넣어 두면 다음 여행이 편해요',
    '미리 모은 돈으로 가는 여행이 제일 편해요',
  ],
  car: [
    '이 페이스면 1년에 {연}이에요',
    '유지비는 예산을 잡아 두면 덜 놀라요',
    '남는 돈은 수리비 통장으로 미리 빼 두세요',
  ],
  culture: [
    '이 페이스면 1년에 {연}이에요',
    '월 한도를 정해 두면 마음 놓고 즐겨도 돼요',
    '아낀 만큼은 다음 공연 값으로 모아 두세요',
  ],
  pet: [
    '반려 통장을 따로 만들면 병원비 걱정이 줄어요',
    '매달 조금씩만 넣어 둬도 든든해요',
    '예산 안에서 쓰면 아까운 돈이 아니에요',
  ],
  booze: [
    '이 페이스면 1년에 {연}이에요',
    '한 주만 쉬어도 꽤 남아요',
    '줄인 만큼은 다른 곳에 쓸 수 있어요',
  ],
  default: [
    '이 페이스면 1년에 {연}이에요',
    '아낀 만큼은 적금으로 옮겨 두세요',
    '남는 돈은 바로 통장을 나눠 두세요',
  ],
}

// ── 불리 실행 액션 ────────────────────────────
const ACTIONS: Record<ReduceSub | 'default', string> = {
  sub: '안 보는 구독 하나 지금 해지하기',
  delivery: '이번 주는 배달 앱 잠깐 지워두기',
  cafe: '카페 한 달 한도 정해두기',
  taxi: '택시 한 달 한도 정해두기',
  shopping: '장바구니에 하루 재워두기',
  telecom: '알뜰폰 요금제 비교해보기',
  food: '식비 한 달 한도 정해두기',
  beauty: '꾸밈비 한 달 예산 정해두기',
  travel: '여행 통장 따로 만들기',
  car: '자동차 유지비 예산 잡아두기',
  culture: '문화생활 예산 정해두기',
  pet: '반려 지출 예산 잡아두기',
  booze: '술·모임 한 달 한도 정해두기',
  default: '남는 {금액} 적금으로 옮기기',
}

// ── 지켜도 되는 지출 ──────────────────────────
const PROTECT_SOFT = {
  식비: '이번 끼니는 {금액}이에요. 다음 한 끼만 집밥으로 해 보세요',
  데이트: '데이트는 지켜도 되는 지출이에요. 한 번에 {금액}이면 다음엔 조금 가볍게 가도 돼요',
  기본: '{카테고리} {금액}이에요. 지켜도 되는 지출인데 이번엔 조금 컸어요',
}
const PROTECT_OK = [
  '줄이지 않아도 되는 지출이에요',
  '{카테고리}는 그대로 두세요',
  '꼭 필요한 지출로 기록했어요',
]

// ── 저축·투자 ─────────────────────────────────
// 한 번 넣은 돈을 10년 곱하지 않는다. '매달 이만큼이면'을 반드시 붙인다.
const GROW = [
  '이번 달 저축 {금액} · 매달 이만큼이면 10년 {10년}',
  '투자로 잡혔어요',
  '{금액} 넣었어요. 이 페이스면 1년에 {연}이에요',
  '투자 {금액} 기록했어요',
]
const LEVERAGE_LINE = [
  '{카테고리} {금액}이에요. 자산을 만드는 지출이에요',
  '{카테고리}는 감당할 수 있는 선이면 그대로 가도 돼요',
]
const INCOME = ['수입 {금액} 들어왔어요', '{금액} 확인했어요. 모으고 불릴 준비가 됐어요']

// ── 중립 ──────────────────────────────────────
const RECEIPT = ['기록 완료', '접수했어요', '오늘도 기록했어요']
const NEUTRAL_MID = ['{카테고리} {금액}이에요', '{카테고리} {금액} 기록했어요']
const NEUTRAL_HIGH: Line[][] = [
  [
    { who: '모아', text: '{카테고리} {금액}, 큰 지출이에요. 적어 두면 다음 달 예산 잡기가 쉬워요' },
    { who: '불리', text: '계획에 있던 거면 그대로 가요. 아니면 다음 달 예산에 넣어 둘게요' },
  ],
]

// ── 치환 ──────────────────────────────────────
function makeVars(c: { category: string; amount: number }, monthCount: number, monthSum: number) {
  return {
    '{금액}': formatWon(c.amount),
    '{카테고리}': c.category,
    '{n}': String(monthCount),
    '{월합}': formatWon(monthSum),
    // 이번 달 이 카테고리 합계가 1년/10년 이어졌을 때. 문구에서 '이 페이스면'을 붙여 쓴다.
    '{연}': abbreviateKRW(monthSum * 12),
    '{10년}': abbreviateKRW(monthSum * 120),
  } as Record<string, string>
}
function fill(text: string, vars: Record<string, string>): string {
  let out = text
  for (const k of Object.keys(vars)) out = out.split(k).join(vars[k])
  return out
}

// ── 최근에 나온 말은 안 나오게 ────────────────
/**
 * 후보가 2개뿐이면 예전 방식(직전 것만 회피)은 A→B→A→B로 딱 번갈아 나와서
 * "똑같은 말만 한다"가 된다. 그래서 최근 몇 개를 기억해 두고 통째로 뺀다.
 */
const RECENT_KEEP = 3
function noRepeat<T>(arr: readonly T[], key: string, idOf: (t: T) => string): T {
  if (arr.length <= 1) return arr[0]
  const storeKey = `gypz-recent-${key}`
  let recent: string[] = []
  try {
    const raw = JSON.parse(localStorage.getItem(storeKey) ?? '[]')
    if (Array.isArray(raw)) recent = raw.filter((x): x is string => typeof x === 'string')
  } catch {
    recent = []
  }
  const keep = Math.min(RECENT_KEEP, arr.length - 1)
  const banned = new Set(recent.slice(0, keep))
  const fresh = arr.filter((t) => !banned.has(idOf(t)))
  const pool = fresh.length > 0 ? fresh : arr
  const pick = pool[Math.floor(Math.random() * pool.length)]
  localStorage.setItem(storeKey, JSON.stringify([idOf(pick), ...recent].slice(0, keep)))
  return pick
}
const asStr = (s: string) => s

// ── 메인 ──────────────────────────────────────
export function pickReaction(
  c: Pick<Confession, 'category' | 'kind' | 'amount'>,
  all: Confession[] = [],
): Reaction {
  // 무지출은 유일하게 잔소리가 아니라 칭찬을 받는 기록이다.
  if (c.category === NO_SPEND) {
    const days = noSpendCount(all)
    return {
      bubbles: [
        { who: '모아', text: noRepeat(NO_SPEND_MOA, 'nospend-moa', asStr) },
        {
          who: '불리',
          text:
            days >= 2 ? `이번 달 안 쓴 날이 ${days}일이에요` : '오늘 안 쓴 만큼이 그대로 남았어요',
        },
      ],
    }
  }

  const bucket = bucketOf(c.kind, c.category)
  const ym = currentYm()
  const same = all.filter((x) => x.category === c.category && ymOfIso(x.createdAt) === ym)
  const monthCount = Math.max(1, same.length)
  const monthSum = same.reduce((s, x) => s + x.amount, 0) || c.amount
  const vars = makeVars(c, monthCount, monthSum)
  const f = (t: string) => fill(t, vars)

  if (bucket === 'reduce') {
    const sub = reduceSub(c.kind, c.category)!
    // "또야, 이번 달 1번째"가 나오던 것 — 이번 달 첫 기록이면 횟수({n})를 쓰는 줄은 뽑지 않는다
    const roastPool = monthCount >= 2 ? ROAST[sub] : ROAST[sub].filter((t) => !t.includes('{n}'))
    const moa = f(noRepeat(roastPool.length ? roastPool : ROAST[sub], `roast-${sub}`, asStr))
    const bulli = f(noRepeat(UPSIDE[sub] ?? UPSIDE.default, `upside-${sub}`, asStr))
    return {
      bubbles: [
        { who: '모아', text: moa },
        { who: '불리', text: bulli },
      ],
      action: f(ACTIONS[sub] ?? ACTIONS.default),
    }
  }

  if (bucket === 'protect') {
    if (c.amount >= 100_000) {
      const key = c.category.includes('식비') ? '식비' : isDate(c.category) ? '데이트' : '기본'
      return { bubbles: [{ who: '모아', text: f(PROTECT_SOFT[key]) }] }
    }
    return { bubbles: [{ who: '불리', text: f(noRepeat(PROTECT_OK, 'protectok', asStr)) }] }
  }

  if (bucket === 'grow') {
    return { bubbles: [{ who: '불리', text: f(noRepeat(GROW, 'grow', asStr)) }] }
  }

  if (bucket === 'leverage') {
    return { bubbles: [{ who: '불리', text: f(noRepeat(LEVERAGE_LINE, 'lev', asStr)) }] }
  }

  if (bucket === 'income') {
    return { bubbles: [{ who: '불리', text: f(noRepeat(INCOME, 'income', asStr)) }] }
  }

  // neutral (기타·세금 등)
  if (c.amount < 30_000) {
    return { bubbles: [{ who: '모아', text: f(noRepeat(RECEIPT, 'receipt', asStr)) }] }
  }
  if (c.amount < 100_000) {
    return { bubbles: [{ who: '모아', text: f(noRepeat(NEUTRAL_MID, 'nmid', asStr)) }] }
  }
  return { bubbles: NEUTRAL_HIGH[0].map((b) => ({ who: b.who, text: f(b.text) })) }
}

// ── 주간 기회비용 ─────────────────────────────
export interface WeeklyCost {
  count: number
  weekSum: number
  perYear: number
  tenYears: number
}

export function weeklyReduceCost(confessions: Confession[]): WeeklyCost {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const reduce = confessions.filter(
    (c) => bucketOf(c.kind, c.category) === 'reduce' && new Date(c.createdAt).getTime() >= weekAgo,
  )
  const weekSum = reduce.reduce((s, c) => s + c.amount, 0)
  return { count: reduce.length, weekSum, perYear: weekSum * 52, tenYears: weekSum * 520 }
}

// ── 무지출 ────────────────────────────────────
const NO_SPEND_MOA = [
  '오늘 0원으로 기록했어요',
  '오늘은 지갑이 쉬었어요',
  '안 쓴 날도 기록이에요',
  '오늘은 짚을 게 없어요',
  '이런 하루가 쌓이면 커요',
]

/** 이번 달 무지출로 기록한 날 수 */
export function noSpendCount(all: Confession[]): number {
  const ym = currentYm()
  const days = new Set(
    all
      .filter((c) => c.category === NO_SPEND && ymOfIso(c.createdAt) === ym)
      .map((c) => new Date(c.createdAt).toLocaleDateString('sv-SE')),
  )
  return days.size
}

// ── 스트릭 ────────────────────────────────────
export function streakOf(confessions: Confession[], memberNo: 1 | 2): number {
  const days = new Set(
    confessions
      .filter((c) => c.memberNo === memberNo)
      .map((c) => new Date(c.createdAt).toLocaleDateString('sv-SE')),
  )
  let streak = 0
  const d = new Date()
  while (days.has(d.toLocaleDateString('sv-SE'))) {
    streak += 1
    d.setDate(d.getDate() - 1)
  }
  return streak
}
