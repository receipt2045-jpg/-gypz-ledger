import { NO_SPEND } from './constants'

type Rec = { createdAt: string; kind: string; category: string; amount: number }

const dayOf = (iso: string) => new Date(iso).toLocaleDateString('sv-SE')

/**
 * 달력에 하트를 그릴 무지출 날 (2026-11-24 결영: "21일은 무지출인데 왜 하트 표시 안 돼 있어?").
 *
 * 예전엔 '무지출' 버튼으로 적은 날만 하트였다 — 그냥 안 쓰고 아무것도 안 적은 날은 빈칸이었다.
 * 이제는 기록을 쓰기 시작한 날부터 어제까지, 변동·고정 지출이 하나도 없는 날도 하트.
 * 오늘은 아직 끝나지 않아서 무지출로 적었을 때만. 집 기준이라 한 사람이 무지출로 적어도
 * 배우자가 쓴 날이면 하트가 아니다. 저축·투자·수입만 있는 날은 무지출로 본다.
 */
export function noSpendDays(
  ym: string,
  monthRecords: Rec[],
  allRecords: Rec[],
  today: string,
): Set<string> {
  const spent = new Set<string>()
  const marked = new Set<string>()
  for (const c of monthRecords) {
    if (c.category === NO_SPEND) marked.add(dayOf(c.createdAt))
    else if ((c.kind === 'variable' || c.kind === 'fixed') && c.amount > 0)
      spent.add(dayOf(c.createdAt))
  }
  let first = ''
  for (const c of allRecords) {
    const d = dayOf(c.createdAt)
    if (!first || d < first) first = d
  }
  const out = new Set<string>()
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  for (let i = 1; i <= last; i++) {
    const date = `${ym}-${String(i).padStart(2, '0')}`
    if (spent.has(date)) continue
    if (marked.has(date) || (first && date >= first && date < today)) out.add(date)
  }
  return out
}
