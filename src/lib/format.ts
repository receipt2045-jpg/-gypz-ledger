const EOK = 100_000_000
const MAN = 10_000

/** 천 단위 콤마만 (원 없이): 1234567 -> "1,234,567" */
export function formatComma(n: number): string {
  return Math.round(n).toLocaleString('ko-KR')
}

/** 천 단위 콤마 + 원: 1234567 -> "1,234,567원" */
export function formatWon(n: number): string {
  return `${formatComma(n)}원`
}

/**
 * 한국식 축약 표기: 123450000 -> "1억 2,345만원"
 * - 1만 미만은 그대로 "N원"
 * - 억/만 단위로 끊어서 표기, 만 미만 잔액은 절사
 */
export function abbreviateKRW(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(Math.round(n))

  if (abs < MAN) {
    return `${sign}${formatComma(abs)}원`
  }

  const eok = Math.floor(abs / EOK)
  const man = Math.floor((abs % EOK) / MAN)

  const parts: string[] = []
  if (eok > 0) parts.push(`${formatComma(eok)}억`)
  if (man > 0) parts.push(`${formatComma(man)}만`)
  if (parts.length === 0) parts.push('0')

  return `${sign}${parts.join(' ')}원`
}

/** 증감 표기: 부호 + 축약. positive 여부도 함께 반환 */
export function signedAbbrev(n: number): { text: string; positive: boolean; zero: boolean } {
  const zero = Math.round(n) === 0
  const positive = n > 0
  const prefix = zero ? '' : positive ? '+' : '-'
  return {
    text: `${prefix}${abbreviateKRW(Math.abs(n))}`,
    positive,
    zero,
  }
}

/** 입력 문자열에서 숫자만 추출 (음수 허용) */
export function parseNumber(str: string): number {
  const cleaned = str.replace(/[^\d-]/g, '')
  if (cleaned === '' || cleaned === '-') return 0
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

/** 비율(0~1)을 정수 퍼센트로: 0.523 -> "52%" */
export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0%'
  return `${Math.round(ratio * 100)}%`
}

/** "2026-07" -> "2026년 7월" */
export function formatYmKorean(ym: string): string {
  const [y, m] = ym.split('-')
  return `${y}년 ${Number(m)}월`
}

/** "2026-07" -> "7월" */
export function formatMonthKorean(ym: string): string {
  const [, m] = ym.split('-')
  return `${Number(m)}월`
}

/** ym 문자열 오프셋: shiftYm("2026-07", -1) -> "2026-06" */
export function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const base = (y * 12 + (m - 1)) + delta
  const ny = Math.floor(base / 12)
  const nm = (base % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

/** 오늘 기준 현재 ym */
export function currentYm(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
