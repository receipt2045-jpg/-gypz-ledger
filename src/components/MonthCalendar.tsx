import { ChevronLeft, ChevronRight } from 'lucide-react'

/** 날짜 칸에 적을 금액 — plus는 들어온 돈(초록), minus는 나간 돈 */
export type DayMark = {
  plus?: number
  minus?: number
  /** 무지출 날 — 하트 (2026-11-24 결영 요청). 어느 날이 무지출인지는 lib/noSpend */
  heart?: boolean
}

/** 칸이 좁아서 짧게 — 32,000 → 3.2만, 4,500 → 4.5천, 1,250,000 → 125만 */
export function shortWon(n: number): string {
  const a = Math.round(Math.abs(n))
  const trim = (v: number) => (v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10))
  if (a >= 100_000_000) return `${trim(a / 100_000_000)}억`
  if (a >= 10_000) return `${trim(a / 10_000)}만`
  if (a >= 1_000) return `${trim(a / 1_000)}천`
  // 683 → 683원 (단위가 없으면 '+3'처럼 뭔지 몰랐다, 2026-11-24)
  return `${a}원`
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 한 달 달력 — 날짜 칸마다 그날 들어온 돈·나간 돈. 날짜를 누르면 그날 기록을 아래에 보여 준다.
 * (2026-11-24 결영 요청: "지출 내역 달력으로도 볼 수 있으면")
 */
export default function MonthCalendar({
  ym,
  marks,
  selected,
  onPick,
  today,
  onMonth,
  plusClass = 'text-brand',
  minusClass = 'text-ink',
  plusFirst = false,
}: {
  /** 들어온 돈을 위에 (부수입) — 아니면 나간 돈이 위 (지출) */
  plusFirst?: boolean
  /** 금액 글씨 색 — 화면마다 들어온 돈·나간 돈 색이 달라서 */
  plusClass?: string
  minusClass?: string
  /** 'YYYY-MM' */
  ym: string
  /** 'YYYY-MM-DD' → 금액 */
  marks: Record<string, DayMark>
  selected: string | null
  onPick: (date: string | null) => void
  /** 'YYYY-MM-DD' */
  today: string
  /** 달 넘기기 — 없으면 화살표를 안 보인다(화면 위에서 달을 고르는 곳) */
  onMonth?: (ym: string) => void
}) {
  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1).getDay()
  const last = new Date(y, m, 0).getDate()
  const cells: (number | null)[] = [
    ...Array<null>(first).fill(null),
    ...Array.from({ length: last }, (_, i) => i + 1),
  ]
  while (cells.length % 7) cells.push(null)
  const dateOf = (d: number) => `${ym}-${String(d).padStart(2, '0')}`
  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  return (
    <div>
      {onMonth && (
        <div className="mb-1.5 flex items-center justify-center gap-3">
          <button
            onClick={() => onMonth(shift(-1))}
            aria-label="지난달 달력"
            className="rounded-full p-1 text-sub active:bg-bg"
          >
            <ChevronLeft size={18} />
          </button>
          <p className="tnum min-w-[88px] text-center text-[14px] font-bold text-ink">
            {y}년 {m}월
          </p>
          <button
            onClick={() => onMonth(shift(1))}
            disabled={shift(1) > today.slice(0, 7)}
            aria-label="다음 달 달력"
            className="rounded-full p-1 text-sub active:bg-bg disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-cap">
        {WEEK.map((w, i) => (
          <span key={w} className={`py-1 ${i === 0 ? 'text-danger/70' : ''}`}>
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5" role="grid" aria-label={`${m}월 달력`}>
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />
          const date = dateOf(d)
          const mk = marks[date]
          const isSel = selected === date
          const isToday = today === date
          const future = date > today
          return (
            <button
              key={date}
              onClick={() => onPick(isSel ? null : date)}
              aria-pressed={isSel}
              aria-label={`${m}월 ${d}일${mk?.minus ? ` 나간 돈 ${mk.minus.toLocaleString()}원` : ''}${
                mk?.plus ? ` 들어온 돈 ${mk.plus.toLocaleString()}원` : ''
              }${mk?.heart ? ' 무지출' : ''}`}
              className={`flex min-h-[50px] flex-col items-center rounded-lg px-0.5 pt-1 ${
                isSel ? 'bg-ink/[0.06] ring-1 ring-ink/30' : 'active:bg-bg'
              }`}
            >
              <span
                className={`tnum flex h-5 w-5 items-center justify-center rounded-full text-[12px] ${
                  isToday
                    ? 'bg-brand font-bold text-white'
                    : future
                      ? 'text-cap/60'
                      : i % 7 === 0
                        ? 'text-danger/80'
                        : 'text-ink'
                }`}
              >
                {d}
              </span>
              <span className={`mt-0.5 flex w-full ${plusFirst ? 'flex-col-reverse' : 'flex-col'}`}>
                {mk?.heart ? (
                  <span aria-hidden className="text-[12px] leading-tight text-rose-500">
                    ♥
                  </span>
                ) : null}
                {mk?.minus ? (
                  <span
                    className={`tnum w-full truncate text-[10px] font-bold leading-tight ${minusClass}`}
                  >
                    −{shortWon(mk.minus)}
                  </span>
                ) : null}
                {mk?.plus ? (
                  <span
                    className={`tnum w-full truncate text-[10px] font-bold leading-tight ${plusClass}`}
                  >
                    +{shortWon(mk.plus)}
                  </span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
