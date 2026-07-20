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
type ReduceSub = 'sub' | 'telecom' | 'delivery' | 'cafe' | 'taxi' | 'shopping' | 'food' | 'beauty'

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
  if (c.includes('꾸밈') || c.includes('미용') || c.includes('화장') || c.includes('네일') || c.includes('헤어')) return 'beauty'
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
  action?: string // 불리 실행 액션 (면죄부 방지, 버튼)
  style?: 'tikitaka' | 'unit'
}

// ── 대사 풀 (공식) ────────────────────────────
type Line = { who: '모아' | '불리'; text: string }

const ROAST: Record<ReduceSub, string[]> = {
  sub: [
    '구독 또…? 안 보는 거 넷플이 더 잘 알아 💀',
    '결제일마다 자동이체는 되는데, 재생 버튼은 언제 눌렀어? 😮‍💨',
    '이 구독들 다 합치면 월세를 보태겠다 🫠',
  ],
  delivery: [
    '배달 또…? 이번 달 {n}번째. 이러다 배달앱이 널 부양하겠어 💀',
    '냉장고는 텅, 배달앱은 풀가동. 냉장고가 파업하겠다 😵',
    '잔고보다 배달앱 즐겨찾기가 더 많은 거… 실화? 🫠',
  ],
  cafe: [
    '또 카페? 스벅 별은 쌓이는데 잔고는 안 쌓여 ☕💀',
    '카페 사장님은 네 이름 외웠겠다. 통장은 널 잊었고 😭',
  ],
  taxi: [
    '택시비 그거… 다리가 공짜라는 거 잊었나 봐 🚕💀',
    '이 택시들 다 모았으면 지금쯤 차 뽑았어 🚗',
  ],
  shopping: [
    '장바구니 담을 땐 부자, 결제할 땐 거지. 다 봤어 👀',
    "'이건 투자야'… 아니 그건 그냥 지름이야 💀",
  ],
  telecom: [
    '통신비 이게 실화야? 알뜰폰이 저기서 손 흔드는 거 안 보여? 📱💀',
    '요금제 그대로 두는 것도 지출이야. 게으름세 내는 중 😮‍💨',
  ],
  food: [
    '식비 또…? 이번 달 {n}번째. 냉장고가 서운해서 문이 안 닫혀 🍚😤',
    '외식 맛있지. 근데 매일이면 취미가 아니라 지출이야 😵',
  ],
  beauty: [
    '머리에 금가루라도 발랐어? {금액}이 순삭이네 💇✨',
    '거울 속 나는 셀럽, 통장 속 나는 일반인 💀',
    '예뻐지는 건 좋아. 근데 잔고도 좀 예뻐야지 😮‍💨',
  ],
}

// 불리: 아낀 돈을 현실적 업사이드로 (이 돈 모으면 ~ 되겠다)
const UPSIDE: Record<ReduceSub | 'default', string[]> = {
  sub: [
    '이 구독료 1년이면 {연}이야. 적금 하나 더 들 돈이지 🐷',
    '안 보는 거 끊어서 나 줘. {월합}부터 불려볼게 📈',
  ],
  delivery: [
    '한 달만 배달 줄여도 {월합} 굳어. 그게 종잣돈이야 🐷',
    '이거 안 시키고 1년 모으면 {연}. 여행 하나 나오겠다 ✈️',
  ],
  cafe: [
    '커피값 1년이면 {연}. 좋은 홈카페 장비 사고도 남아 ☕',
    '이거 모으면 {월합}. 텀블러 값 뽑고 남지 🐷',
  ],
  taxi: [
    '이 {금액} 10년 모으면 {10년}. 그땐 진짜 유럽 가자 ✈️',
    '택시 대신 걸으면 건강도 벌고 {월합}도 벌어 🚶',
  ],
  shopping: [
    '이거 참으면 {월합}. 진짜 갖고 싶던 거 하나 사겠다',
    '지금 안 사고 모으면 1년에 {연}. 그게 더 크지 않아? 📈',
  ],
  telecom: [
    '알뜰폰으로 갈면 매달 굳어. 1년이면 목돈이야 🐷',
    '통신비만 줄여도 {월합}. 자동이체로 적금 돌리자 📈',
  ],
  food: [
    '이 {금액} 집밥으로 돌리면 며칠은 버텨. 남는 돈은 나 줘 📈',
    '식비 한 달만 잡아도 {월합}. 그게 종잣돈 된다 🐷',
  ],
  beauty: [
    '이거 아끼면 1년에 {연}. 다음 시술은 그 돈으로 하자 💆',
    '꾸밈도 예산 안에서 하면 완벽해. 남는 건 나한테 맡겨 📈',
  ],
  default: [
    '이거 모으면 {월합}, 1년이면 {연}이야 🐷',
    '아낀 돈은 나 불리한테 맡겨. 더 키워줄게 📈',
  ],
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
  beauty: '다음 달 꾸밈 예산, 한번 정해둘까요? 👉',
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
    // 모아: 웃긴 팩폭(Cleo 톤) → 불리: 현실적 업사이드(이 돈 모으면 ~)
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
