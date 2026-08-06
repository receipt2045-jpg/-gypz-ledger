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
//       오만원 / 구천원 / 만이천원 / 삼만오천 / 십만
//       "오만 5000원"처럼 한글과 숫자가 섞인 것도 55,000으로 읽는다.
//
// 정규식 하나로는 한글 수사를 감당할 수 없어 왼쪽부터 훑는 방식으로 바꿨다.
// 어려운 점은 '읽는 것'이 아니라 '안 읽는 것'이다 — 천천히·만나서·이만큼처럼
// 수사가 들어간 평범한 말을 금액으로 오인하면 안 된다.

const KO_DIGIT: Record<string, number> = {
  영: 0, 공: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9,
}
const KO_SMALL: Record<string, number> = { 십: 10, 백: 100, 천: 1_000 }
const KO_BIG: Record<string, number> = { 만: 10_000, 억: 100_000_000 }
const KO_NUM = new Set([
  ...Object.keys(KO_DIGIT), ...Object.keys(KO_SMALL), ...Object.keys(KO_BIG),
])
const HANGUL = /[가-힣]/

interface AmountMatch {
  amount: number
  start: number
  end: number
}

interface Scan {
  amount: number
  end: number // '원'까지 포함한 끝 위치
  hasUnit: boolean // 만/천/백/십이 있었는지
  hasWon: boolean
  hasKorean: boolean
  startsKorean: boolean
}

/**
 * start 위치에서 금액 하나를 읽는다.
 *
 * 자릿수 누적 규칙은 한국어 수 읽기 그대로다:
 *   삼(current) 만(→ section을 만 단위로 확정) 오(current) 천(section에 더함)
 * '만/억' 뒤 공백은 나머지 자릿수가 이어질 수 있으므로 한 번만 넘어간다
 * ("오만 5000" = 55,000). 그 외 공백에서는 멈춘다 ("5000 3000"이 합쳐지지 않게).
 */
function scanAmount(text: string, start: number): Scan | null {
  let i = start
  let total = 0
  let section = 0
  let current = 0
  let hasCurrent = false
  let hasUnit = false
  let hasKorean = false
  let sawAny = false
  let lastWasBig = false
  const startsKorean = KO_NUM.has(text[start])

  const flushBig = (mult: number) => {
    let s = section + current
    if (!hasCurrent && section === 0) s = 1 // "만원" = 10,000
    total += s * mult
    section = 0
    current = 0
    hasCurrent = false
  }

  while (i < text.length) {
    const ch = text[i]

    if (/\d/.test(ch)) {
      const m = /^\d[\d,]*(?:\.\d+)?/.exec(text.slice(i))!
      current = parseFloat(m[0].replace(/,/g, ''))
      hasCurrent = true
      sawAny = true
      lastWasBig = false
      i += m[0].length
      continue
    }
    if (KO_DIGIT[ch] !== undefined) {
      current = KO_DIGIT[ch]
      hasCurrent = true
      sawAny = true
      hasKorean = true
      lastWasBig = false
      i++
      continue
    }
    if (KO_SMALL[ch] !== undefined) {
      section += (hasCurrent ? current : 1) * KO_SMALL[ch]
      current = 0
      hasCurrent = false
      hasUnit = true
      sawAny = true
      hasKorean = true
      lastWasBig = false
      i++
      continue
    }
    if (KO_BIG[ch] !== undefined) {
      flushBig(KO_BIG[ch])
      hasUnit = true
      sawAny = true
      hasKorean = true
      lastWasBig = true
      i++
      continue
    }
    // 만/억 바로 뒤 공백만 넘어간다 — 나머지 자릿수가 이어지는 자리
    if (ch === ' ' && lastWasBig) {
      const next = text[i + 1]
      if (next && (/\d/.test(next) || KO_NUM.has(next))) {
        lastWasBig = false
        i++
        continue
      }
    }
    break
  }

  if (!sawAny) return null
  total += section + current

  const won = /^\s*원/.exec(text.slice(i))
  return {
    amount: total,
    end: won ? i + won[0].length : i,
    hasUnit,
    hasWon: !!won,
    hasKorean,
    startsKorean,
  }
}

/** 텍스트에서 금액으로 볼 수 있는 부분을 모두 찾는다 (등장 순서) */
function findAmounts(text: string): AmountMatch[] {
  const out: AmountMatch[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (!/\d/.test(ch) && !KO_NUM.has(ch)) {
      i++
      continue
    }
    const r = scanAmount(text, i)
    if (!r) {
      i++
      continue
    }
    const prev = i > 0 ? text[i - 1] : ''
    const after = text[r.end] ?? ''
    const ok =
      r.amount > 0 &&
      r.amount <= 999_999_999 &&
      // 낱말 중간에서 시작한 수사는 버린다 ("고기만두"의 만)
      !(r.startsKorean && HANGUL.test(prev)) &&
      // 뒤에 한글이 붙으면 수사가 아니라 낱말이다 (천천히·만나서·이만큼)
      !(r.hasKorean && !r.hasWon && HANGUL.test(after)) &&
      // 단위도 '원'도 없는 세 자리 이하는 금액으로 보기 애매하다
      (r.hasUnit || r.hasWon || r.amount >= 1000)

    if (ok) {
      out.push({ amount: Math.round(r.amount), start: i, end: r.end })
      i = r.end
    } else {
      i++
    }
  }
  return out
}

/** 라벨 후보 정리 — 앞뒤 구분자·조사 꼬리를 털어낸다 */
function cleanLabel(s: string): string {
  return s
    .replace(/\s+/g, ' ')
    .replace(/^[\s,·]+|[\s,·]+$/g, '')
    .replace(/(에|은|는|이|가|을|를|로|으로)$/, '')
    .trim()
}

/** 조각에서 가장 큰 금액 하나와 나머지 텍스트 (단건 확인용) */
export function extractAmount(segment: string): { amount: number; rest: string } | null {
  const all = findAmounts(segment)
  if (!all.length) return null
  const best = all.reduce((a, b) => (b.amount > a.amount ? b : a))
  const rest = (segment.slice(0, best.start) + ' ' + segment.slice(best.end))
    .replace(/\s+/g, ' ')
    .trim()
  return { amount: best.amount, rest }
}

/**
 * 한 조각을 금액 개수만큼 항목으로 쪼갠다.
 * 음성인식은 쉼표를 넣어주지 않아 "점심 9000원 커피 5500원"이 한 덩어리로 들어온다.
 * 금액마다 바로 앞의 말을 이름으로 삼고, 앞이 비었으면 바로 뒤의 말을 쓴다.
 */
function splitByAmounts(segment: string): { amount: number; label: string }[] {
  const found = findAmounts(segment)
  if (!found.length) return []

  // 금액 사이(및 앞뒤)의 텍스트 조각들
  const gaps: string[] = []
  gaps.push(cleanLabel(segment.slice(0, found[0].start)))
  for (let i = 1; i < found.length; i++) {
    gaps.push(cleanLabel(segment.slice(found[i - 1].end, found[i].start)))
  }
  const tail = cleanLabel(segment.slice(found[found.length - 1].end))

  return found.map((f, i) => ({
    amount: f.amount,
    // 앞의 말이 비었으면 뒤의 말로 대체 ("9천원 점심" 같은 어순도 받기 위함)
    label: gaps[i] || (i === found.length - 1 ? tail : gaps[i + 1]) || '',
  }))
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
    const parts = splitByAmounts(seg)
    if (!parts.length) {
      skipped.push(seg)
      continue
    }
    for (const part of parts) {
      // 이름이 비면 조각 전체를 후보로 (한 건짜리 문장에서 어순이 뒤집힌 경우)
      const found = findCategory(part.label || seg, categories, aliases)
      const note = part.label || undefined
      const raw = part.label ? `${part.label} ${part.amount}원` : seg
      if (found) {
        entries.push({ ...found, amount: part.amount, note, raw, matched: true })
      } else {
        // 폴백은 반드시 이 가구에 실재하는 카테고리여야 함
        // ('기타'를 지운 가구에서 화면 표시와 저장값이 어긋나는 것 방지)
        const fallback = categories.variable.includes('기타')
          ? '기타'
          : (categories.variable[0] ?? '기타')
        entries.push({
          category: fallback,
          kind: 'variable',
          amount: part.amount,
          note,
          raw,
          matched: false,
        })
      }
    }
  }
  return { entries, skipped }
}
