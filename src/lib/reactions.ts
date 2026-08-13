// ============================================================
// 일일 고백 반응 엔진 (원팀가계부)
//
// 말투 규칙 (결영이네):
//   - 대구·잠언체 금지. "A는 ~한데 B는 ~다" 구조를 쓰지 않는다.
//   - 이모지는 거의 안 쓴다. 칭찬하는 자리에만 가끔 하나.
//   - 짧게. 한 줄에 한 가지만.
//   - 겁주지 않는다. 먼저 겪어본 사람이 옆에서 말해주는 톤.
//   - 숫자는 실제로 맞는 것만. 한 번 쓴 돈을 10년 곱해서 들이대지 않는다.
//
// 캐릭터: 모아(눈치채고 짚어줌) → 불리(그래서 얼마 남는지 계산해줌)
// 치환: {금액}{카테고리}{n}{월합}{연}{10년}
// ============================================================
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
  if (c.includes('꾸밈') || c.includes('미용') || c.includes('화장') || c.includes('네일') || c.includes('헤어')) return 'beauty'
  if (c.includes('여행') || c.includes('항공') || c.includes('숙박') || c.includes('호텔')) return 'travel'
  if (c.includes('자동차') || c.includes('주유') || c.includes('기름') || c.includes('주차')) return 'car'
  if (c.includes('문화') || c.includes('공연') || c.includes('영화') || c.includes('게임') || c.includes('전시') || c.includes('콘서트')) return 'culture'
  if (c.includes('반려') || c.includes('강아지') || c.includes('고양이') || c.includes('댕댕') || c.includes('냥')) return 'pet'
  if (c.includes('술') || c.includes('유흥') || c.includes('음주') || c.includes('맥주') || c.includes('소주') || c.includes('와인') || c.includes('회식') || c.includes('파티')) return 'booze'
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
// 매달 반복되는 지출(구독·통신)만 '1년이면' 같은 환산을 쓴다.
const ROAST: Record<ReduceSub, string[]> = {
  sub: [
    '구독 또 늘었네. 이번 달 {n}번째야',
    '{금액} 나갔어. 안 보는 것도 같이 결제되고 있을걸',
    '이번 달 구독에만 {월합} 썼어',
    '해지 안 하면 내년에도 똑같이 나가',
    '안 본 지 오래된 거 하나쯤 있잖아',
    '결제일은 잘 챙기는데 재생 버튼은 언제 눌렀어',
  ],
  delivery: [
    '배달 또야? 이번 달 {n}번째',
    '{금액}. 배달비만 따로 세보면 더 놀랄걸',
    '이번 달 배달에 {월합} 나갔어',
    '냉장고 열어본 게 언제야',
    '"오늘만"이 이번 달에 {n}번 나왔어',
    '시켜 먹는 날이 요리하는 날보다 많아졌어',
  ],
  cafe: [
    '오늘도 카페 갔구나. 이번 달 {n}번째야',
    '{금액}. 한 잔 값 같아도 모이면 커져',
    '이번 달 카페에만 {월합}이야',
    '사장님이 네 주문 외웠겠다',
    '집에서 내려 마시는 날도 좀 만들자',
    '커피는 마셔야지. 근데 매일은 좀 많다',
  ],
  taxi: [
    '택시 {금액}. 오늘 급했나 보네',
    '이번 달 택시에만 {월합} 썼어',
    '10분만 일찍 나오면 안 나갈 돈이야',
    '한두 번은 괜찮아. 습관 되면 커져',
    '이번 달 {n}번째야',
  ],
  shopping: [
    '또 질렀네. 이번 달 {n}번째야',
    '{금액}. 필요해서 산 거 맞아?',
    '이번 달 쇼핑에 {월합} 나갔어',
    '장바구니에 하루만 두고 봐도 안 늦어',
    '살 때는 좋았지. 다음 달 카드값에서 다시 보자',
    '세일이라 산 거면 산 게 아니라 걸린 거야',
  ],
  telecom: [
    '통신비 {금액}이야. 요금제 언제 바꿨어?',
    '약정 끝났는데 그대로 두면 그게 제일 비싸',
    '이번 달 통신비 {월합}. 알뜰폰이면 절반은 줄어',
    '한 번만 바꿔두면 매달 알아서 굳는 돈이야',
  ],
  food: [
    '식비 또야. 이번 달 {n}번째',
    '{금액}. 오늘은 밖에서 먹었구나',
    '이번 달 식비만 {월합}이야',
    '장 본 지 얼마나 됐어?',
    '한 끼만 집밥으로 돌려도 표가 나',
    '외식 맛있지. 근데 매일이면 좀 많아',
  ],
  beauty: [
    '{금액} 나갔네. 오늘 예뻐졌겠다',
    '이번 달 꾸밈비 {월합}이야',
    '예산 안에서 하면 마음도 편해',
    '이번 달 {n}번째야. 조금만 텀을 두자',
    '이건 줄이라고 안 할게. 대신 한도는 정하자',
  ],
  travel: [
    '여행 {금액} 나갔어',
    '이번 달 여행에 {월합} 썼어',
    '미리 모아뒀으면 지금 덜 아팠을 텐데',
    '다음엔 여행 통장 먼저 만들고 가자',
    '다녀온 건 좋았고, 카드값은 다음 달에 와',
  ],
  car: [
    '차 유지비 {금액} 나갔어',
    '이번 달 차에만 {월합}이야',
    '기름값에 주차비까지 매달 꾸준히 나가',
    '세워둬도 돈이 나가는 게 차더라',
    '이번 달 {n}번째야',
  ],
  culture: [
    '{금액}. 오늘 좋은 거 봤겠다',
    '이번 달 문화비 {월합}이야',
    '이번 달 {n}번째야. 다음 건 다음 달로 미뤄볼까',
    '예산 잡아두면 마음 놓고 봐도 돼',
  ],
  pet: [
    '{금액} 나갔네. 우리 애기한테 쓴 거니까',
    '이번 달 반려비 {월합}이야',
    '병원비는 갑자기 오니까 따로 모아두자',
    '이건 줄이라고 안 할게. 대신 예산은 잡자',
  ],
  booze: [
    '어제 술값 {금액}이야',
    '이번 달 술자리에 {월합} 썼어',
    '이번 달 {n}번째야. 이번 주는 좀 쉬자',
    '즐거웠으면 됐어. 근데 이번 달은 많다',
    '{금액}. 안주까지 시켰구나',
  ],
}

// ── 불리: 그래서 얼마가 남는지 ────────────────
// '{연}'은 이 페이스가 1년 이어졌을 때. 반드시 '이 페이스면'을 붙여 쓴다.
const UPSIDE: Record<ReduceSub | 'default', string[]> = {
  sub: [
    '이 페이스면 1년에 {연}이야. 안 보는 것부터 끊자',
    '구독 하나만 정리해도 매달 그대로 굳어',
    '끊은 만큼 적금으로 돌리면 그게 종잣돈이야',
  ],
  delivery: [
    '이 페이스면 1년에 {연}이야',
    '한 달만 반으로 줄여도 꽤 남아',
    '줄인 만큼 나한테 맡겨. 굴려볼게',
  ],
  cafe: [
    '이 페이스면 1년에 {연}이야',
    '주 이틀만 집에서 마셔도 표가 나',
    '아낀 만큼은 자동이체로 빼두자',
  ],
  taxi: [
    '이 페이스면 1년에 {연}이야',
    '걷는 날 하루 늘리면 그만큼 남아',
    '남는 건 비상금 통장으로 보내자',
  ],
  shopping: [
    '이 페이스면 1년에 {연}이야',
    '지금 참으면 진짜 갖고 싶던 걸 살 수 있어',
    '하루 재워두고도 사고 싶으면 그때 사',
  ],
  telecom: [
    '요금제만 갈아도 1년이면 {연} 근처야',
    '한 번 바꿔두면 신경 안 써도 매달 굳어',
    '줄인 금액만큼 적금 자동이체 걸어두자',
  ],
  food: [
    '이 페이스면 1년에 {연}이야',
    '한 주에 두 끼만 집밥으로 돌려도 남아',
    '장 보는 날 정해두면 훨씬 덜 나가',
  ],
  beauty: [
    '이 페이스면 1년에 {연}이야',
    '월 한도만 정해두면 죄책감 없이 써도 돼',
    '남는 건 따로 빼두자. 다음 시술이 편해져',
  ],
  travel: [
    '여행 통장 따로 모으면 다녀와서 안 아파',
    '매달 조금씩 넣어두면 다음엔 업그레이드야',
    '미리 모은 돈으로 가는 여행이 제일 편해',
  ],
  car: [
    '이 페이스면 1년에 {연}이야',
    '유지비는 예산 잡아두면 덜 놀라',
    '남는 건 수리비 통장으로 미리 빼두자',
  ],
  culture: [
    '이 페이스면 1년에 {연}이야',
    '월 한도 정해두면 마음 놓고 봐도 돼',
    '아낀 만큼은 다음 공연 값으로 모으자',
  ],
  pet: [
    '반려 통장 따로 만들면 병원비가 안 무서워',
    '매달 조금씩만 넣어둬도 든든해',
    '예산 안에서 쓰면 이건 아까운 돈 아니야',
  ],
  booze: [
    '이 페이스면 1년에 {연}이야',
    '한 주만 쉬어도 꽤 남아',
    '줄인 만큼은 좋은 술 한 병으로 바꾸자',
  ],
  default: [
    '이 페이스면 1년에 {연}이야',
    '아낀 만큼은 나한테 맡겨. 굴려볼게',
    '남는 돈은 바로 통장을 나눠두자',
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
  식비: '먹는 건 지켜야죠. 근데 이번엔 {금액}이라 조금 컸어요. 다음 한 끼만 집밥 어떨까요',
  데이트: '데이트는 지키는 지출이에요. 한 번에 {금액}이면 다음엔 좀 소소하게 가도 좋고요',
  기본: '{카테고리} {금액}이에요. 지켜도 되는 지출인데 이번엔 조금 컸어요',
}
const PROTECT_OK = [
  '이건 지켜도 되는 지출이에요',
  '{카테고리}는 그냥 넘어갈게요',
  '이런 건 아끼는 게 답이 아니에요',
]

// ── 저축·투자 ─────────────────────────────────
// 한 번 넣은 돈을 10년 곱하지 않는다. '매달 이만큼이면'을 반드시 붙인다.
const GROW = [
  '{금액} 저축 확인했어요. 매달 이만큼이면 10년에 {10년}이에요',
  '투자 들어갔네요. 이 그림이 제일 좋아요 🤍',
  '{금액} 넣었어요. 이 페이스면 1년에 {연}이에요',
  '오늘 넣은 게 제일 확실한 수익이에요',
]
const LEVERAGE_LINE = [
  '{카테고리} {금액}이에요. 이건 자산을 만드는 지출이라 줄이라고 안 할게요',
  '{카테고리}는 감당선 안이면 괜찮아요. 그대로 가요',
]
const INCOME = [
  '수입 {금액} 들어왔네요 🤍',
  '{금액} 확인했어요. 모으고 불릴 준비 됐어요',
]

// ── 중립 ──────────────────────────────────────
const RECEIPT = ['기록 완료', '접수했어요', '오늘도 남겼네요']
const NEUTRAL_MID = [
  '{카테고리} {금액}, 이 정도는 괜찮아요',
  '{카테고리} {금액} 기록했어요',
]
const NEUTRAL_HIGH: Line[][] = [
  [
    { who: '모아', text: '{카테고리} {금액}이네. 큰 지출은 적어둔 것만으로 반은 했어' },
    { who: '불리', text: '계획에 있던 거면 그대로 가요. 아니면 다음 달 예산에 넣어둘게요' },
  ],
]

// ── 치환 ──────────────────────────────────────
function makeVars(
  c: { category: string; amount: number },
  monthCount: number,
  monthSum: number,
) {
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
            days >= 2
              ? `이번 달 안 쓴 날이 ${days}일이에요. 이런 날이 쌓이는 게 제일 확실해요`
              : '오늘 안 쓴 만큼이 그대로 남았어요',
        },
      ],
    }
  }

  const bucket = bucketOf(c.kind, c.category)
  const ym = new Date().toISOString().slice(0, 7)
  const same = all.filter((x) => x.category === c.category && x.createdAt.slice(0, 7) === ym)
  const monthCount = Math.max(1, same.length)
  const monthSum = same.reduce((s, x) => s + x.amount, 0) || c.amount
  const vars = makeVars(c, monthCount, monthSum)
  const f = (t: string) => fill(t, vars)

  if (bucket === 'reduce') {
    const sub = reduceSub(c.kind, c.category)!
    const moa = f(noRepeat(ROAST[sub], `roast-${sub}`, asStr))
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
  '오늘 한 푼도 안 썼다고? 웬일이야',
  '지갑이 하루 푹 쉬었네',
  '안 쓴 날도 기록이야. 이런 날이 쌓여',
  '오늘은 잔소리할 게 없네',
  '이런 날 하루가 생각보다 커',
]

/** 이번 달 무지출로 기록한 날 수 */
export function noSpendCount(all: Confession[]): number {
  const ym = new Date().toISOString().slice(0, 7)
  const days = new Set(
    all
      .filter((c) => c.category === NO_SPEND && c.createdAt.slice(0, 7) === ym)
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
