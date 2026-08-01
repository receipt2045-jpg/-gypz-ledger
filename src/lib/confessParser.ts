import type { Categories, CategoryGroup } from '../types'

// ── 줄글 고백 파서 ─────────────────────────────
// "점심 김밥 9천원, 커피 5,500원, 택시 만이천원" 같은 자유 입력을
// 고백 항목들로 바꾼다. 전부 로컬 계산 — 네트워크·LLM 없음.

export interface ParsedEntry {
  category: string
  kind: CategoryGroup
  amount: number
  note?: string
  raw: string // 원문 조각 (확인 화면 표시용)
  matched: boolean // 카테고리를 자신 있게 찾았는지 (false면 기타로 폴백)
}

export interface ParseResult {
  entries: ParsedEntry[]
  /** 금액을 못 찾아 버린 조각들 (확인 화면에서 안내) */
  skipped: string[]
}

/** 내장 별칭 사전 — 단어(또는 접두어) → 기본 카테고리명 */
// 사용자가 카테고리를 고치면 가구 별칭(category_aliases)이 여기에 덮어써진다.
export const BUILTIN_ALIASES: Record<string, string> = {
  // 식비
  점심: '식비', 저녁: '식비', 아침: '식비', 밥: '식비', 김밥: '식비', 국밥: '식비',
  회식: '식비', 외식: '식비', 마트: '식비', 장보기: '식비', 편의점: '식비', 술: '식비',
  치킨: '배달', 피자: '배달', 배민: '배달', 요기요: '배달', 쿠팡이츠: '배달', 야식: '배달',
  // 카페
  커피: '카페', 스벅: '카페', 스타벅스: '카페', 아아: '카페', 라떼: '카페', 디저트: '카페', 빵: '카페',
  // 교통/차
  택시: '자동차', 주유: '자동차', 기름: '자동차', 세차: '자동차', 주차: '자동차',
  버스: '자동차', 지하철: '자동차', 교통: '자동차', 톨비: '자동차',
  // 생활
  다이소: '생활용품', 세제: '생활용품', 휴지: '생활용품', 쿠팡: '생활용품',
  // 구독/통신
  넷플: '구독', 넷플릭스: '구독', 유튜브: '구독', 멜론: '구독', 디플: '구독',
  폰: '통신', 요금제: '통신',
  // 건강/꾸밈
  병원: '건강', 약국: '건강', 약: '건강', 헬스: '건강', 필라테스: '건강',
  미용실: '꾸밈', 화장품: '꾸밈', 네일: '꾸밈', 옷: '꾸밈', 신발: '꾸밈',
  // 문화/육아/반려
  영화: '문화생활', 공연: '문화생활', 게임: '문화생활', 책: '자기계발', 강의: '자기계발',
  기저귀: '육아', 분유: '육아', 장난감: '육아', 학원: '육아',
  사료: '반려견', 간식: '반려견', 동물병원: '반려견',
  // 경조사/여행
  축의금: '경조사', 부조: '경조사', 조의금: '경조사', 선물: '경조사',
  숙소: '여행', 항공권: '여행', 비행기: '여행',
}

// ── 금액 파싱 ──────────────────────────────────
// 지원: 12,000원 / 5500 / 9천원 / 1만2천 / 3만 / 만원 / 1.5만
// 미지원(1차): 순한글 숫자(구천원, 만이천원)

// 뒤 lookbehind: "만이천원"의 "천원"처럼 순한글 숫자의 꼬리를 금액으로 오인하지 않기 위함
const AMOUNT_RE =
  /(\d[\d,]*(?:\.\d+)?)\s*(만|천|백)?\s*(\d[\d,]*)?\s*(만|천|백)?\s*원?|(?<![일이삼사오육칠팔구십백천만\d])(만|천)\s*원/g

function unitValue(u: string | undefined): number {
  return u === '만' ? 10_000 : u === '천' ? 1_000 : u === '백' ? 100 : 1
}

/** 조각에서 금액(원)과 금액 부분을 제거한 나머지 텍스트를 뽑는다 */
export function extractAmount(segment: string): { amount: number; rest: string } | null {
  AMOUNT_RE.lastIndex = 0
  let best: { amount: number; start: number; end: number } | null = null
  let m: RegExpExecArray | null
  while ((m = AMOUNT_RE.exec(segment))) {
    let amount = 0
    if (m[5]) {
      // "만원" / "천원" 단독
      amount = unitValue(m[5])
    } else {
      const n1 = parseFloat(m[1].replace(/,/g, ''))
      if (!Number.isFinite(n1)) continue
      amount = n1 * unitValue(m[2])
      if (m[3]) amount += parseFloat(m[3].replace(/,/g, '')) * unitValue(m[4])
      // "5500" 같은 단위 없는 맨숫자: 3자리 이하는 금액으로 보기엔 애매하므로 버림
      // (단, "원"이 붙어 있으면 그대로 인정 — "500원")
      const hasUnit = !!m[2] || !!m[4] || /원\s*$/.test(m[0].trim())
      if (!hasUnit && amount < 1000) continue
    }
    amount = Math.round(amount)
    if (amount <= 0 || amount > 999_999_999) continue
    // 같은 조각에 숫자가 여럿이면 더 큰 쪽(금액일 확률이 높은 쪽)을 채택
    if (!best || amount > best.amount) best = { amount, start: m.index, end: m.index + m[0].length }
  }
  if (!best) return null
  const rest = (segment.slice(0, best.start) + ' ' + segment.slice(best.end))
    .replace(/\s+/g, ' ')
    .trim()
  return { amount: best.amount, rest }
}

// ── 카테고리 매칭 ──────────────────────────────

function findCategory(
  text: string,
  categories: Categories,
  aliases: Record<string, string>,
): { category: string; kind: CategoryGroup } | null {
  const expenseGroups: CategoryGroup[] = ['variable', 'fixed']
  // 1) 사용자 카테고리명이 직접 들어 있으면 최우선
  for (const kind of expenseGroups) {
    for (const cat of categories[kind]) {
      if (cat !== '기타' && text.includes(cat)) return { category: cat, kind }
    }
  }
  // 2) 별칭 사전 (학습 별칭이 내장보다 우선)
  const dict = { ...BUILTIN_ALIASES, ...aliases }
  for (const [word, cat] of Object.entries(dict)) {
    if (!text.includes(word)) continue
    for (const kind of expenseGroups) {
      if (categories[kind].includes(cat)) return { category: cat, kind }
    }
  }
  return null
}

// ── 메인 ──────────────────────────────────────

export function parseConfessionText(
  text: string,
  categories: Categories,
  aliases: Record<string, string> = {},
): ParseResult {
  // 쉼표는 바로 뒤에 숫자가 오면 천 단위 구분(5,500)이므로 자르지 않는다
  const segments = text
    .split(/[\n·]|,(?!\d)|그리고|하고\s/)
    .map((s) => s.trim())
    .filter(Boolean)

  const entries: ParsedEntry[] = []
  const skipped: string[] = []

  for (const seg of segments) {
    const money = extractAmount(seg)
    if (!money) {
      skipped.push(seg)
      continue
    }
    const found = findCategory(money.rest || seg, categories, aliases)
    const note = money.rest || undefined
    if (found) {
      entries.push({ ...found, amount: money.amount, note, raw: seg, matched: true })
    } else {
      entries.push({
        category: '기타',
        kind: 'variable',
        amount: money.amount,
        note,
        raw: seg,
        matched: false,
      })
    }
  }
  return { entries, skipped }
}
