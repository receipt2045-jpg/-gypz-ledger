// ============================================================
// 일일 고백 잔소리 판정 엔진 (원팀가계부)
// 대사: 《원팀가계부 캐릭터 대사 세트》 공식 풀 그대로.
// 톤: 관점엔진 E(따뜻하지만 단호·완충어·숫자 설득). 캐릭터가 대신 말함.
// 판정: 3분법 bucket + 강도. reduce 초과는 [티키타카]↔[단위환산] 교차.
// 치환: {금액}{카테고리}{n}{월합}{연}{10년}{알뜰족}{치킨}{스벅}{항공권}{제주}{소고기}
// ============================================================
import type { CategoryGroup, Confession } from '../types'
import { abbreviateKRW, formatWon } from './format'

// ── 3분법 버킷 ────────────────────────────────
export type Bucket = 'reduce' | 'protect' | 'leverage' | 'grow' | 'income' | 'neutral'
type ReduceSub = 'sub' | 'telecom' | 'delivery' | 'cafe' | 'taxi' | 'shopping' | 'food'

const PROTECT = new Set(['용돈', '자기계발', '경조사', '육아'])
const LEVERAGE = new Set(['주거'])

/** reduce(저효용 고정비) 세부 분류 — 기본 통신·구독 + 사용자 커스텀 카테고리 키워드 */
function reduceSub(kind: CategoryGroup, category: string): ReduceSub | null {
  if (kind === 'income' || kind === 'saving' || kind === 'investment') return null
  const c = category
  if (c.includes('구독') || c.includes('OTT') || c.includes('넷플')) return 'sub'
  if (c.includes('통신') || c.includes('폰')) return 'telecom'
  if (c.includes('배달') || c.includes('외식')) return 'delivery'
  if (c.includes('카페') || c.includes('커피')) return 'cafe'
  if (c.includes('택시')) return 'taxi'
  if (c.includes('쇼핑') || c.includes('충동') || c.includes('꾸밈')) return 'shopping'
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
  action?: string // 불리 실행 액션 (면죄부 방지, 버튼)
  style?: 'tikitaka' | 'unit'
}

// ── 대사 풀 (공식) ────────────────────────────
type Line = { who: '모아' | '불리'; text: string }

const ROAST: Record<ReduceSub, string[]> = {
  sub: [
    '또 구독이요…? 🙄 안 보는 거 다 알아요. 오늘 하나는 해지하실 분!',
    '이거 1년이면 {연}, 10년이면 {10년}이에요. 그 돈이 안 아까우세요?',
    "자기계발 구독은 봐드려요. 근데 이건 그냥 '소비'잖아요. 정리하실 분! ❗️",
  ],
  delivery: [
    '또 배달이요? 이번 달 벌써 {n}번째. 주방이 서운해합니다.',
    '{금액}이면 장 봐서 3일은 먹어요. 손가락이 너무 부지런하네요 🙄',
  ],
  cafe: ['오늘도 카페요? ☕ {금액} × 한 달이면 {월합}이에요. 텀블러가 웁니다.'],
  taxi: ['택시요…? 🚕 그 {금액}, 10년이면 {10년}이에요. 다리는 뒀다 뭐 해요.'],
  shopping: [
    '이거 진짜 필요해요? 🫣 하루만 재워두실 분! 내일이면 마음 식어요.',
    '지금 사면 이번 달 잉여현금 증발이에요. 손 떼실 분! ❗️',
  ],
  telecom: [
    '통신비 이게 말이 돼요…? 약정 끝났으면 알뜰폰, 오늘 바로요. 알뜰족은 {알뜰족}이에요.',
  ],
  food: [
    '식비 또요? 🍚 이번 달 {n}번째. 냉장고 한 번 열어봅시다.',
    '{금액}이면 집밥으로 며칠은 든든해요. 다음 한 끼는 집에서!',
    '외식도 좋지만 오늘은 좀 과했어요. 내일 한 끼는 집밥 어때요?',
  ],
}

// 8-A 티키타카 (모아·불리 만담)
const TIKITAKA: Partial<Record<ReduceSub, Line[][]>> = {
  delivery: [
    [
      { who: '모아', text: '또 배달?! 이번 달 {n}번째예요. 진심이세요? 🙄' },
      { who: '불리', text: '에이 모아야~ 오늘 야근했대.' },
      { who: '모아', text: '야근했다고 지갑까지 야근하란 법 있어요?!' },
      { who: '불리', text: '…팩폭 세다. 주말은 집밥 콜.' },
    ],
  ],
  cafe: [
    [
      { who: '모아', text: '오늘도 카페 출근 도장이네요 ☕' },
      { who: '불리', text: '커피가 있어야 일하지~' },
      { who: '모아', text: '텀블러가 있어야 통장이 살지!' },
      { who: '불리', text: '…맞말이라 할 말 없다.' },
    ],
  ],
  shopping: [
    [
      { who: '모아', text: '이거 진짜 필요했어요? 🫤' },
      { who: '불리', text: '예쁘긴 하더라…' },
      { who: '모아', text: '불리!!' },
      { who: '불리', text: '아 미안 미안 ㅋㅋ 하루만 재워두자' },
    ],
  ],
  taxi: [
    [
      { who: '모아', text: '택시요…? 🚕' },
      { who: '불리', text: '늦었다잖아~ 한 번쯤은' },
      { who: '모아', text: '그 돈이면 10년 뒤 유럽인데!' },
      { who: '불리', text: '…다음엔 버스 콜.' },
    ],
  ],
  sub: [
    [
      { who: '모아', text: '구독 또 늘었어요?!' },
      { who: '불리', text: '볼 게 많긴 해…' },
      { who: '모아', text: '볼 시간에 릴스나 만들자!' },
      { who: '불리', text: '모아 오늘 팩폭 지린다 ㅋㅋ' },
    ],
  ],
  food: [
    [
      { who: '모아', text: '식비 또 나갔네요 🍚 이번 달 {n}번째예요.' },
      { who: '불리', text: '먹어야 일하지~' },
      { who: '모아', text: '집밥이어야 통장이 살죠!' },
      { who: '불리', text: '알겠어알겠어 ㅋㅋ 주말은 집밥 콜.' },
    ],
  ],
}

// 8-B 단위환산 드립 (금액에서 개수 계산)
function unitLine(sub: ReduceSub, amount: number, monthSum: number): string | null {
  const cnt = (unit: number) => Math.max(1, Math.round(amount / unit))
  switch (sub) {
    case 'delivery':
      return `배달 {금액} = 치킨 ${cnt(23000)}마리예요 🍗 (참으면 더 대단!)`
    case 'cafe':
      return `카페값 {금액} = 스벅 ${cnt(4900)}잔. 텀블러 각!`
    case 'taxi':
      return amount >= 30000
        ? '택시 {금액}… 10년이면 유럽 왕복 항공권이에요 ✈️'
        : `택시 {금액} = 버스 ${cnt(1500)}번이에요 🚌`
    case 'sub':
      return `구독료 1년 {연} = 제주도 ${Math.max(1, Math.round((monthSum * 12) / 80000))}번 갈 돈 🏝`
    case 'shopping':
      return `이번에 쓴 {금액} = 소고기 ${cnt(50000)}근 🥩`
    case 'food':
      return `식비 {금액} = 집밥 ${cnt(4000)}끼예요 🍚`
    case 'telecom':
      return null
  }
}

// 4) 불리 실행 액션 (면죄부 방지)
const ACTIONS: Record<ReduceSub | 'default', string> = {
  sub: '지금 바로 OTT 하나 해지하러 갈래요? 👉',
  delivery: '이번 주 배달 앱 잠깐 지워보기, 같이 할까요? 👉',
  cafe: '이 카테고리, 다음 달 한도 정해둘까요? 👉',
  taxi: '이 카테고리, 다음 달 한도 정해둘까요? 👉',
  shopping: '장바구니에 하루만 재워두기, 어때요? 👉',
  telecom: '약정 끝났으면 알뜰폰 요금제 비교해 볼까요? 👉',
  food: '식비, 다음 달 한도 정해둘까요? 👉',
  default: '남는 {금액}, 지금 적금으로 옮겨둘까요? 👉',
}

// 2) protect
const PROTECT_SOFT = {
  식비: '먹는 건 지켜야죠 🤍 근데 이번 주는 살짝 과했어요. 다음 한 끼만 집밥 어때요?',
  데이트: '데이트는 소중해요 🤍 근데 한 번에 {금액}이면… 다음엔 소소한 데이트도 좋아요!',
  기본: '{카테고리} {금액}, 지킬 지출이지만 혹시 조금만 조정해 볼 수 있을까요? 말씀만 드려봅니다.',
}
const PROTECT_OK = ['이건 지켜도 되는 지출이에요. 근데 이것도 쌓이면 무시 못 해요 😉', '{카테고리}는 봐드려요. 대신 통신·구독·배달은 제가 지켜보고 있습니다 😉']

// 3) grow
const GROW = [
  '오 저축 기록! 👏 이 {금액}이 10년 뒤엔 {10년}이 돼요. 잘하고 있어요 🤍',
  '투자 들어갔네요! 불리가 제일 좋아하는 그림이에요. 계속 가요 🤍',
  '{금액} 저축 고백 접수! 미래의 두 분이 지금의 두 분에게 감사할 거예요 🤍',
]
// leverage(내집마련 대출 등) — 줄이라 하지 않음 (관점엔진 A-2 ③)
const LEVERAGE_LINE = [
  '{카테고리} {금액} — 이건 자산을 만드는 지출이에요. 감당선 안에서는 줄이라고 안 할게요 👍',
]
const INCOME = ['수입 {금액} 축하해요 🎉 모으고 불릴 준비 완료!']

// 6) 접수 (소액·중립)
const RECEIPT = ['기록 완료! 🤍 잘 던졌어요.', '오케이, 접수! 다음 고백도 기다릴게요 😉']
const NEUTRAL_MID = ['{카테고리} {금액}, 요 정도는 봐드릴게요. 오늘도 고백해 줘서 고마워요 😉']
const NEUTRAL_HIGH: Line[][] = [
  [
    { who: '모아', text: '{카테고리} {금액}?! 큰 지출은 고백해 준 것만으로도 반은 성공이에요.' },
    { who: '불리', text: '계획에 있던 지출이면 통과! 아니면 다음 달 예산에 꼭 넣어봐요 😉' },
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
    '{연}': abbreviateKRW(monthSum * 12),
    '{10년}': abbreviateKRW(monthSum * 120),
    '{알뜰족}': '월 3만 원',
  } as Record<string, string>
}
function fill(text: string, vars: Record<string, string>): string {
  let out = text
  for (const k of Object.keys(vars)) out = out.split(k).join(vars[k])
  return out
}

// ── 순환/교차 상태 (연속 같은 것 방지) ─────────
function noRepeat<T>(arr: readonly T[], key: string, idOf: (t: T) => string): T {
  const lastKey = `gypz-last-${key}`
  const last = localStorage.getItem(lastKey)
  let pick = arr[Math.floor(Math.random() * arr.length)]
  if (arr.length > 1 && idOf(pick) === last) {
    pick = arr[(arr.indexOf(pick) + 1) % arr.length]
  }
  localStorage.setItem(lastKey, idOf(pick))
  return pick
}
const asStr = (s: string) => s
const firstText = (b: Line[]) => b[0].text
const STYLE_KEY = 'gypz-last-reduce-style'
function nextReduceStyle(): 'tikitaka' | 'unit' {
  const last = localStorage.getItem(STYLE_KEY)
  const next = last === 'tikitaka' ? 'unit' : 'tikitaka'
  localStorage.setItem(STYLE_KEY, next)
  return next
}

// ── 메인 ──────────────────────────────────────
export function pickReaction(
  c: Pick<Confession, 'category' | 'kind' | 'amount'>,
  all: Confession[] = [],
): Reaction {
  const bucket = bucketOf(c.kind, c.category)
  const ym = new Date().toISOString().slice(0, 7)
  const same = all.filter((x) => x.category === c.category && x.createdAt.slice(0, 7) === ym)
  const monthCount = Math.max(1, same.length)
  const monthSum = same.reduce((s, x) => s + x.amount, 0) || c.amount
  const vars = makeVars(c, monthCount, monthSum)
  const f = (t: string) => fill(t, vars)

  if (bucket === 'reduce') {
    const sub = reduceSub(c.kind, c.category)!
    let style = nextReduceStyle()
    if (style === 'tikitaka' && !TIKITAKA[sub]) style = 'unit' // 티키타카 없으면 단위환산

    let bubbles: Bubble[]
    if (style === 'tikitaka') {
      bubbles = noRepeat(TIKITAKA[sub]!, `tk-${sub}`, firstText).map((b) => ({
        who: b.who,
        text: f(b.text),
      }))
    } else {
      const roast = f(noRepeat(ROAST[sub], `roast-${sub}`, asStr))
      const unit = unitLine(sub, c.amount, monthSum)
      bubbles = [{ who: '모아', text: roast }]
      if (unit) bubbles.push({ who: '모아', text: f(unit) })
    }
    return { bubbles, action: f(ACTIONS[sub] ?? ACTIONS.default), style }
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

// ── 주간 기회비용 (면죄부 방지) ────────────────
// 이번 주 '줄일 수 있었던' 지출(reduce 버킷)을 모아 적금 기회비용으로 환산.
export interface WeeklyCost {
  count: number // 이번 주 reduce 고백 횟수
  weekSum: number // 이번 주 reduce 합계
  perYear: number // 매주 이만큼 아끼면 1년
  tenYears: number // 10년
}

export function weeklyReduceCost(confessions: Confession[]): WeeklyCost {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const reduce = confessions.filter(
    (c) => bucketOf(c.kind, c.category) === 'reduce' && new Date(c.createdAt).getTime() >= weekAgo,
  )
  const weekSum = reduce.reduce((s, c) => s + c.amount, 0)
  return { count: reduce.length, weekSum, perYear: weekSum * 52, tenYears: weekSum * 520 }
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
