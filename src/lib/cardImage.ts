import type { MonthlyCardData } from './monthlyCard'
import { abbreviateKRW, formatWon, formatYmKorean } from './format'

/**
 * 결산 카드를 PNG로 그린다.
 *
 * 외부 라이브러리(html2canvas 등)를 쓰지 않는 이유: 배포 CSP가 외부 스크립트를
 * 막아서 어차피 못 쓴다. canvas로 직접 그리면 의존성도 없고 결과도 일정하다.
 * 크기는 1080 정사각형 — 카톡에서 세로로 잘리지 않는 비율.
 */
const SIZE = 1080
const INK = '#0F1519'
const SUB = '#3A4655'
const CAP = '#69737F'
const BLUE = '#1F6FE5'
const LINE = '#DCE1E7'
const FONT = `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Segoe UI", system-ui, sans-serif`

function bold(px: number) {
  return `700 ${px}px ${FONT}`
}
function extra(px: number) {
  return `800 ${px}px ${FONT}`
}

/** 가운데 정렬 텍스트 */
function center(ctx: CanvasRenderingContext2D, text: string, y: number, color: string) {
  ctx.fillStyle = color
  ctx.fillText(text, SIZE / 2 - ctx.measureText(text).width / 2, y)
}

/** 라벨(왼쪽) + 값(오른쪽) 한 줄 */
function row(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  y: number,
  valueColor = INK,
) {
  const pad = 130
  ctx.font = bold(34)
  ctx.fillStyle = CAP
  ctx.fillText(label, pad, y)
  ctx.font = extra(40)
  ctx.fillStyle = valueColor
  ctx.fillText(value, SIZE - pad - ctx.measureText(value).width, y)
}

/** 폭에 맞춰 줄바꿈 (한 줄 평이 길어질 때) */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

export function drawMonthlyCard(canvas: HTMLCanvasElement, d: MonthlyCardData): void {
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.textBaseline = 'alphabetic'

  // 머리말
  ctx.font = bold(36)
  center(ctx, `${formatYmKorean(d.ym)} 우리집 성적표`, 130, CAP)

  // 주인공 숫자 — 저축·투자율
  ctx.font = bold(38)
  center(ctx, '저축 · 투자율', 235, SUB)
  ctx.font = extra(190)
  center(ctx, `${Math.round(d.savingInvestRate * 100)}%`, 400, BLUE)
  ctx.font = bold(34)
  center(ctx, `${formatWon(d.savingInvest)} 모았어요`, 460, CAP)

  // 구분선
  ctx.strokeStyle = LINE
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(130, 520)
  ctx.lineTo(SIZE - 130, 520)
  ctx.stroke()

  // 숫자 세 줄
  const up = d.netWorthDelta >= 0
  row(ctx, '순자산', abbreviateKRW(d.netWorth), 595, d.netWorth < 0 ? '#FF6B6B' : INK)
  row(
    ctx,
    '지난달보다',
    `${up ? '+' : '−'}${abbreviateKRW(Math.abs(d.netWorthDelta))}`,
    670,
    up ? BLUE : '#FF6B6B',
  )
  row(ctx, '잉여현금', formatWon(d.surplus), 745, d.surplus < 0 ? '#FF6B6B' : INK)
  row(ctx, d.memberNames[0], formatWon(d.memberSaving[0]), 820)
  row(ctx, d.memberNames[1], formatWon(d.memberSaving[1]), 895)

  // 한 줄 평
  ctx.font = bold(36)
  const lines = wrap(ctx, d.headline, SIZE - 240)
  lines.forEach((ln, i) => center(ctx, ln, 985 + i * 48, SUB))

  // 브랜드
  ctx.font = bold(30)
  const mark = '모아불리'
  const mw = ctx.measureText(mark).width
  ctx.fillStyle = BLUE
  ctx.beginPath()
  ctx.arc(SIZE / 2 - mw / 2 - 22, SIZE - 66, 8, 0, Math.PI * 2)
  ctx.fill()
  center(ctx, mark, SIZE - 56, CAP)
}

/** 카드를 PNG 파일로 만든다 */
export async function cardToFile(d: MonthlyCardData): Promise<File | null> {
  const canvas = document.createElement('canvas')
  drawMonthlyCard(canvas, d)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) return null
  return new File([blob], `모아불리-${d.ym}.png`, { type: 'image/png' })
}

/**
 * 공유 → 실패하면 저장.
 * 모바일은 navigator.share로 카톡에 바로 보낼 수 있고, PC는 다운로드로 떨어진다.
 */
export async function shareCard(d: MonthlyCardData): Promise<'shared' | 'saved' | 'failed'> {
  const file = await cardToFile(d)
  if (!file) return 'failed'

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${formatYmKorean(d.ym)} 우리집 성적표` })
      return 'shared'
    } catch (err) {
      // 사용자가 공유 시트를 닫은 경우 — 저장으로 내려가지 않고 조용히 끝낸다
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared'
    }
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
  return 'saved'
}
