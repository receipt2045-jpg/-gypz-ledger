// ============================================================
// 일일 고백 잔소리 판정 엔진 (원팀가계부 브리프 4 · 관점엔진 3분법)
// 1단 규칙 기반 — 로컬에서 즉시 판정, 네트워크 대기 없음.
//
// ⚠️ 대사 풀(POOLS)은 《원팀가계부 캐릭터 대사 세트》 수령 전까지의
//    임시 문구입니다. 문서를 받으면 이 파일의 풀만 교체하면 됩니다.
//    (관점엔진 E. 코칭 말투: 따뜻하지만 단호, 완충어, 숫자 설득 준수)
// ============================================================
import type { CategoryGroup, Confession } from '../types'
import { formatWon } from './format'

// ── 3분법 버킷 (관점엔진 A-2) ─────────────────
export type Bucket = 'reduce' | 'protect' | 'leverage' | 'grow' | 'income' | 'neutral'

const REDUCE = new Set(['통신', '구독'])
const PROTECT = new Set(['식비', '용돈', '자기계발', '경조사', '육아'])
const LEVERAGE = new Set(['주거'])

export function bucketOf(kind: CategoryGroup, category: string): Bucket {
  if (kind === 'income') return 'income'
  if (kind === 'saving' || kind === 'investment') return 'grow'
  if (REDUCE.has(category)) return 'reduce'
  if (PROTECT.has(category)) return 'protect'
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
  style?: 'tikitaka' | 'unit' // reduce 전용 (교차 출력 확인용)
}

// ── 단위환산 드립 (브리프 4 재미 규칙) ────────
function unitDrip(amount: number): string {
  if (amount < 10_000) {
    const cups = Math.max(1, Math.round(amount / 4_500))
    return `아메리카노 ${cups}잔`
  }
  if (amount < 100_000) {
    const chickens = Math.round((amount / 23_000) * 10) / 10
    return `치킨 ${chickens}마리`
  }
  const flights = Math.round((amount / 80_000) * 10) / 10
  return `제주행 항공권 ${flights}장`
}

// 10년 환산 (관점엔진 A.4 — 매달 나가는 고정비 기준)
function tenYears(amount: number): string {
  const total = amount * 12 * 10
  if (total >= 100_000_000) return `${Math.round(total / 10_000_000) / 10}억원`
  return `${Math.round(total / 10_000)}만원`
}

// ── 임시 대사 풀 (교체 예정) ──────────────────
// {amt}=금액, {cat}=카테고리, {unit}=단위환산, {ten}=10년 환산
const POOLS = {
  reduceUnit: [
    [
      { who: '모아', text: '잔소리 좀 드려도 될까요? {cat}에 {amt}… 그 돈이면 {unit}이에요 ㅠㅠ' },
      { who: '모아', text: '매달 이러면 10년이면 {ten}입니다. 많이 많이 줄이셔야 해요!!' },
    ],
    [
      { who: '모아', text: '{cat} {amt} 고백 접수… 죄송하지만 이건 {unit} 값이에요!!' },
      { who: '모아', text: '혹시 약정·구성부터 조금이라도 점검해 보실래요? 10년이면 {ten}이에요.' },
    ],
  ],
  reduceTikitaka: [
    [
      { who: '모아', text: '{cat}에 {amt}?! 이건 말이 안 됩니다!! 허리띠 졸라매야 해요!!' },
      { who: '불리', text: '모아야 진정해… 그래도 오늘 고백은 하셨잖아. 다음 달엔 같이 줄여봐요 😉' },
    ],
    [
      { who: '모아', text: '또 {cat}이에요?? 매달 새는 돈이 제일 무섭습니다 ㅠㅠ' },
      { who: '불리', text: '대신 이 {amt}만큼 다음 달 저축을 늘리면… 그건 제가 응원할게요!' },
    ],
  ],
  protectOk: [
    [{ who: '불리', text: '{cat} {amt}, 이건 지킬 지출이에요. 먹고 싶은 건 먹어야죠 🤍' }],
    [{ who: '모아', text: '{cat}은 잔소리 안 할게요. 대신 통신비·구독은 제가 지켜보고 있습니다 😉' }],
  ],
  protectHigh: [
    [
      { who: '모아', text: '{cat} {amt}… 지킬 지출이지만, 혹시 조금만 조정해 볼 수 있을까요? 말씀만 드려봅니다.' },
      { who: '불리', text: '적정선은 부부마다 달라요. 두 분이 정한 선 안이면 괜찮아요 🤍' },
    ],
  ],
  leverage: [
    [{ who: '불리', text: '{cat} {amt} — 이건 자산을 만드는 지출이에요. 감당선 안에서는 줄이라고 안 할게요 👍' }],
  ],
  grow: [
    [{ who: '불리', text: '{cat}에 {amt}!! 오늘도 불렸네요 🎉 이 맛에 돈 모으는 거죠!' }],
    [{ who: '불리', text: '{amt} 저축 고백 접수! 미래의 두 분이 지금의 두 분에게 감사할 거예요 🤍' }],
  ],
  income: [
    [{ who: '불리', text: '수입 {amt} 축하해요 🎉 모으고 불릴 준비 완료!' }],
  ],
  neutralLight: [
    [{ who: '모아', text: '{cat} {amt}, 요 정도는 봐드릴게요. 오늘도 고백해 줘서 고마워요 😉' }],
  ],
  neutralMid: [
    [
      { who: '모아', text: '{cat}에 {amt}… 흠, {unit} 값이네요. 필요한 지출이었길 바랍니다!' },
    ],
  ],
  neutralHigh: [
    [
      { who: '모아', text: '{cat} {amt}?! 큰 지출은 고백해 준 것만으로도 반은 성공이에요.' },
      { who: '불리', text: '혹시 계획에 있던 지출이면 통과! 아니면… 다음 달 예산에 꼭 넣어봐요 😉' },
    ],
  ],
} as const

// ── 교차 규칙: reduce 반응은 티키타카 ↔ 단위환산 번갈아 ──
const STYLE_KEY = 'gypz-last-reduce-style'

function nextReduceStyle(): 'tikitaka' | 'unit' {
  const last = localStorage.getItem(STYLE_KEY)
  const next = last === 'tikitaka' ? 'unit' : 'tikitaka'
  localStorage.setItem(STYLE_KEY, next)
  return next
}

// ── 메인: 고백 1건 → 반응 ─────────────────────
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function fill(text: string, c: { category: string; amount: number }): string {
  return text
    .split('{cat}').join(c.category)
    .split('{amt}').join(formatWon(c.amount))
    .split('{unit}').join(unitDrip(c.amount))
    .split('{ten}').join(tenYears(c.amount))
}

export function pickReaction(c: Pick<Confession, 'category' | 'kind' | 'amount'>): Reaction {
  const bucket = bucketOf(c.kind, c.category)

  let pool: readonly (readonly { who: '모아' | '불리'; text: string }[])[]
  let style: Reaction['style']

  switch (bucket) {
    case 'reduce': {
      style = nextReduceStyle()
      pool = style === 'tikitaka' ? POOLS.reduceTikitaka : POOLS.reduceUnit
      break
    }
    case 'protect':
      pool = c.amount >= 100_000 ? POOLS.protectHigh : POOLS.protectOk
      break
    case 'leverage':
      pool = POOLS.leverage
      break
    case 'grow':
      pool = POOLS.grow
      break
    case 'income':
      pool = POOLS.income
      break
    default:
      pool =
        c.amount < 30_000
          ? POOLS.neutralLight
          : c.amount < 100_000
            ? POOLS.neutralMid
            : POOLS.neutralHigh
  }

  const bubbles = pick(pool).map((b) => ({ who: b.who, text: fill(b.text, c) }))
  return { bubbles, style }
}

// ── 스트릭: 오늘까지 연속 고백 일수 (구성원 기준) ──
export function streakOf(confessions: Confession[], memberNo: 1 | 2): number {
  const days = new Set(
    confessions
      .filter((c) => c.memberNo === memberNo)
      .map((c) => new Date(c.createdAt).toLocaleDateString('sv-SE')), // YYYY-MM-DD (로컬)
  )
  let streak = 0
  const d = new Date()
  while (days.has(d.toLocaleDateString('sv-SE'))) {
    streak += 1
    d.setDate(d.getDate() - 1)
  }
  return streak
}
