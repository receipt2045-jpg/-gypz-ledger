import type { LeaveMonth, LeaveResult, LeaveRun } from './parentalLeave'

/**
 * 육아휴직 계산 결과를 PNG 한 장으로 그린다 (남편에게 보내거나 사진으로 저장).
 *
 * cardImage.ts와 같은 이유로 canvas에 직접 그린다 — 배포 CSP가 외부 스크립트를 막는다.
 * 1080 정사각형: 카톡에서 세로로 잘리지 않는 비율.
 * 월급 같은 입력 숫자는 싣지 않는다. 사진이 어디로 퍼질지 모르니 결과만 담는다.
 */
const SIZE = 1080
const PAD = 90
const INK = '#191F28'
const SUB = '#4E5968'
const CAP = '#8B95A1'
const BLUE = '#3182F6'
const BLUE_BG = '#E8F1FE'
const RED = '#F04452'
const RED_BG = '#FDECEE'
const GRAY_BAR = '#D1D6DB'
const BG = '#F2F4F6'
const FONT = `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard Variable", Pretendard, "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif`

const font = (weight: number, px: number) => `${weight} ${px}px ${FONT}`
const man = (n: number) => Math.round(Math.abs(n) / 10_000).toLocaleString('ko-KR')

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function centerText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number) {
  ctx.fillText(text, cx - ctx.measureText(text).width / 2, y)
}

const periodLabel = (r: LeaveRun) => (r.from === r.to ? `${r.from}개월` : `${r.from}~${r.to}개월`)

function whoLabel(m: LeaveMonth): string {
  const w = m.wifeState !== 'work'
  const h = m.husbandState !== 'work'
  if (w && h) return '둘 다 휴직'
  return w ? '아내 휴직' : '남편 휴직'
}

/** 칸은 4개까지. 넘치면 앞 3칸 + 마지막 칸(보통 가장 힘든 구간)을 보여준다 */
export function pickRuns(runs: LeaveRun[]): { shown: LeaveRun[]; skipped: number } {
  if (runs.length <= 4) return { shown: runs, skipped: 0 }
  return { shown: [...runs.slice(0, 3), runs[runs.length - 1]], skipped: runs.length - 4 }
}

export function drawLeaveCard(canvas: HTMLCanvasElement, r: LeaveResult, showWho: boolean): void {
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.textBaseline = 'alphabetic'

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = '#FFFFFF'
  roundRect(ctx, 40, 40, SIZE - 80, SIZE - 80, 48)
  ctx.fill()

  // 머리말
  ctx.font = font(700, 30)
  ctx.fillStyle = BLUE
  ctx.fillText('모아불리 가계부', PAD, 130)
  const brandW = ctx.measureText('모아불리 가계부').width
  ctx.fillStyle = CAP
  ctx.fillText(' · 육아휴직 계산기', PAD + brandW, 130)

  // 한 줄 결론
  ctx.font = font(800, 60)
  ctx.fillStyle = INK
  const first =
    r.monthlyNow >= 0
      ? `매달 ${man(r.monthlyNow)}만원 모으던 우리집,`
      : `지금도 매달 ${man(r.monthlyNow)}만원 적자인 우리집,`
  ctx.fillText(first, PAD, 225)
  ctx.fillText('육아휴직하면 한 달에 🍼', PAD, 305)

  // 구간 칸
  const { shown, skipped } = pickRuns(r.runs)
  const gap = 20
  const boxW = (SIZE - PAD * 2 - gap * (shown.length - 1)) / Math.max(1, shown.length)
  const boxY = 350
  const boxH = showWho ? 220 : 190
  shown.forEach((run, i) => {
    const x = PAD + i * (boxW + gap)
    const deficit = run.month.saved < 0
    const tone = deficit ? RED : BLUE
    ctx.fillStyle = deficit ? RED_BG : BLUE_BG
    roundRect(ctx, x, boxY, boxW, boxH, 28)
    ctx.fill()
    const cx = x + boxW / 2
    ctx.fillStyle = tone
    ctx.font = font(600, 28)
    centerText(ctx, periodLabel(run), cx, boxY + 52)
    ctx.font = font(800, shown.length >= 4 ? 52 : 60)
    centerText(ctx, `${deficit ? '−' : ''}${man(run.month.saved)}만`, cx, boxY + 122)
    ctx.font = font(600, 28)
    centerText(ctx, deficit ? '적자예요' : '모여요', cx, boxY + 165)
    if (showWho) {
      ctx.font = font(500, 24)
      centerText(ctx, whoLabel(run.month), cx, boxY + 203)
    }
  })
  let y = boxY + boxH
  if (skipped > 0) {
    ctx.font = font(500, 24)
    ctx.fillStyle = CAP
    ctx.fillText(`중간 ${skipped}구간은 모아불리에서 볼 수 있어요`, PAD, y + 38)
    y += 20
  }

  // 달마다 막대
  const chartTop = y + 60
  const chartH = 190
  const values = r.months.map((m) => m.saved)
  if (values.length > 0) {
    const top = Math.max(r.monthlyNow, ...values, 1)
    const bottom = Math.min(0, r.monthlyNow, ...values)
    const scale = chartH / (top - bottom)
    const zeroY = chartTop + top * scale
    const W = SIZE - PAD * 2
    const slot = W / values.length
    const bw = Math.min(40, slot * 0.65)
    const nowH = Math.max(r.monthlyNow, 0) * scale
    values.forEach((v, i) => {
      const x = PAD + i * slot + (slot - bw) / 2
      ctx.fillStyle = GRAY_BAR
      roundRect(ctx, x, zeroY - nowH, bw, Math.max(nowH, 1), Math.min(6, bw / 2))
      ctx.fill()
      const h = Math.max(Math.abs(v) * scale, 1)
      ctx.fillStyle = v >= 0 ? BLUE : RED
      roundRect(ctx, x, v >= 0 ? zeroY - h : zeroY, bw, h, Math.min(6, bw / 2))
      ctx.fill()
    })
    ctx.fillStyle = CAP
    ctx.font = font(500, 24)
    ctx.fillText('회색은 지금, 파랑은 육아휴직하면 모이는 돈', PAD, chartTop + chartH + 50)
  }

  // 브랜드 두 줄
  const footY = SIZE - 190
  ctx.fillStyle = '#E5E8EB'
  ctx.fillRect(PAD, footY, SIZE - PAD * 2, 2)
  brandLine(ctx, '모아불리 가계부', INK, '우리집 숫자로 계산해보기 · moabuli.com', footY + 60)
  brandLine(ctx, '모아불리 원팀프로젝트', BLUE, '부부가 함께 재테크 시작해요', footY + 110)
}

/** 굵은 이름 + 옆에 한 줄 설명 */
function brandLine(
  ctx: CanvasRenderingContext2D,
  name: string,
  color: string,
  desc: string,
  y: number,
) {
  ctx.font = font(700, 30)
  ctx.fillStyle = color
  ctx.fillText(name, PAD, y)
  const w = ctx.measureText(name).width
  ctx.font = font(500, 26)
  ctx.fillStyle = SUB
  ctx.fillText(desc, PAD + w + 20, y)
}

/** 결과 카드를 PNG 파일로 */
export async function leaveCardFile(r: LeaveResult, showWho: boolean): Promise<File | null> {
  const canvas = document.createElement('canvas')
  drawLeaveCard(canvas, r, showWho)
  if (!canvas.getContext('2d')) return null
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) return null
  return new File([blob], '모아불리-육아휴직-계산.png', { type: 'image/png' })
}
