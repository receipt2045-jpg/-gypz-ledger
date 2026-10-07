import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/** 원팀프로젝트 — 상담 창구가 열리기 전까지 계산기 아래 '결영이네와 같이'가 여기로 간다 */
export const ONETEAM_URL = 'https://oneteamm.netlify.app'

/**
 * 돈 공부 계산기 공통 틀 (2026-10-07) — 뒤로(돈 공부), 제목, 한 줄 설명, 맨 아래 '결영이네와 같이'.
 * PC에서는 앱 틀(AppFrame) 안에서 가운데 720px.
 */
export default function CalcShell({
  title,
  lead,
  cta,
  children,
}: {
  title: string
  lead: string
  /** 맨 아래 검은 버튼 문구 */
  cta: string
  children: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="animate-fade-up space-y-3 lg:mx-auto lg:max-w-[720px]">
      <button
        onClick={() => navigate('/info')}
        className="-ml-1 flex items-center gap-0.5 pt-2 text-[14px] font-semibold text-sub"
      >
        <ChevronLeft size={19} />돈 공부
      </button>
      <header className="px-1">
        <h1 className="text-[20px] font-bold text-ink">{title}</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-sub">{lead}</p>
      </header>
      {children}
      <a
        href={ONETEAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between rounded-card bg-ink px-4 py-3.5 text-[14px] font-bold text-white"
      >
        {cta}
        <ChevronRight size={17} />
      </a>
      <p className="px-1 text-center text-[11.5px] leading-relaxed text-cap">
        참고용 계산이에요. 실제 금액은 금융회사·세무서 확인이 필요해요.
      </p>
    </div>
  )
}

/** 계산기 입력 한 줄 — 이름 왼쪽, 칸 오른쪽. auto면 '가계부에서' 표시 */
export function CalcRow({
  label,
  auto,
  children,
}: {
  label: string
  auto?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-bg py-2.5 last:border-b-0">
      <span className="shrink-0 text-[13.5px] text-sub">
        {label}
        {auto && (
          <span className="ml-1.5 rounded bg-brand/10 px-1.5 py-px text-[10.5px] font-bold text-brand">
            {auto}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  )
}

/** 숫자 칸(나이·% 등) — 단위는 칸 안 오른쪽 */
export function NumField({
  value,
  onChange,
  unit,
  decimal,
  label,
}: {
  value: number
  onChange: (n: number) => void
  unit: string
  decimal?: boolean
  label: string
}) {
  return (
    <span className="ml-auto flex w-[140px] items-center gap-1 rounded-btn border border-line bg-white px-3 focus-within:border-brand">
      <input
        aria-label={label}
        inputMode={decimal ? 'decimal' : 'numeric'}
        value={Number.isFinite(value) ? String(value) : ''}
        onChange={(e) => {
          const raw = e.target.value.replace(decimal ? /[^\d.]/g : /\D/g, '')
          onChange(raw === '' ? 0 : Number(raw))
        }}
        className="tnum min-w-0 w-full bg-transparent py-2 text-right text-[15px] font-semibold text-ink outline-none"
      />
      <span className="shrink-0 text-[13px] text-sub">{unit}</span>
    </span>
  )
}
