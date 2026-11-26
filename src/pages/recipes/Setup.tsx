import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Minus, Plus, Wallet, X } from 'lucide-react'
import { DAY_NAMES, EXCLUDE_CHIPS, NAME_MAX, budgetPreview, houseName, type MealSettings } from '../../lib/mealPlan'
import { PROTEIN_NAME, type Protein } from '../../lib/recipes'
import { Back, man } from './ui'
import type { Planner } from './usePlanner'

const PROTEINS = Object.keys(PROTEIN_NAME) as Protein[]

/** /recipes/setup — 우리집 식비 기준 */
export function Setup({ p }: { p: Planner }) {
  const navigate = useNavigate()
  const [s, set] = useState<MealSettings>(p.settings)
  const [typed, setTyped] = useState('')
  const patch = (x: Partial<MealSettings>) => set({ ...s, ...x })
  const pv = budgetPreview(s)
  const b = p.ledger.budget

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const addTyped = () => {
    const w = typed.trim()
    if (w && !s.exclude.includes(w)) patch({ exclude: [...s.exclude, w] })
    setTyped('')
  }
  const save = () => {
    p.setSettings(s)
    navigate('/recipes')
    window.scrollTo(0, 0)
  }

  return (
    <div className="px-4 pb-6 pt-5">
      <Back to="/recipes" label="이번 주 집밥" />
      <h1 className="mt-3 text-[24px] font-extrabold text-ink">우리집 식비 기준</h1>
      <p className="mt-1 text-[14px] text-sub">정한 대로 식단과 장보기 목록을 짜요. 언제든 바꿀 수 있어요.</p>

      <Block label="우리집 이름" hint={`맨 위에 「${houseName(s)} 집밥」으로 보여요`}>
        <input
          value={s.name}
          onChange={(e) => patch({ name: e.target.value.slice(0, NAME_MAX) })}
          placeholder="예) 민지네"
          maxLength={NAME_MAX}
          className="mt-1 w-full rounded-btn border border-line px-3 py-2.5 text-[15px] text-ink outline-none focus:border-brand"
        />
      </Block>
      <Row label="어른">
        <Stepper value={s.adults} min={1} max={6} text={`${s.adults}명`} onChange={(v) => patch({ adults: v })} />
      </Row>
      <Row label="아이" hint="있으면 매운 메뉴는 빼고, 아기 식판 팁을 같이 보여 줘요">
        <Stepper value={s.kids} min={0} max={4} text={`${s.kids}명`} onChange={(v) => patch({ kids: v })} />
      </Row>
      <Row label="한 주 집밥" hint="장 보는 돈만 — 외식은 아래에 따로">
        <Stepper
          value={s.weekBudget}
          min={30_000}
          max={500_000}
          step={10_000}
          text={`${man(s.weekBudget)}원`}
          onChange={(v) => patch({ weekBudget: v })}
        />
      </Row>
      <Row label="한 번 장볼 때">
        <Stepper
          value={s.tripBudget}
          min={10_000}
          max={300_000}
          step={5_000}
          text={`${man(s.tripBudget)}원`}
          onChange={(v) => patch({ tripBudget: v })}
        />
      </Row>

      <Block label="장 보는 간격">
        <div className="flex gap-1.5">
          {([2, 3, 7] as const).map((n) => (
            <Chip key={n} on={s.interval === n} onClick={() => patch({ interval: n })}>
              {n === 7 ? '일주일' : `${n}일`}
            </Chip>
          ))}
        </div>
      </Block>

      <Block label="외식하는 날" hint="고른 날은 식단에서 비워요">
        <div className="flex flex-wrap gap-1.5">
          {DAY_NAMES.map((d, i) => (
            <Chip
              key={d}
              on={s.deliveryDays.includes(i)}
              onClick={() => {
                const next = toggle(s.deliveryDays, i).sort()
                if (next.length < 7) patch({ deliveryDays: next })
              }}
            >
              {d}
            </Chip>
          ))}
        </div>
        {s.deliveryDays.length > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[14px] text-sub">외식 한 번</span>
            <Stepper
              value={s.deliveryCost}
              min={0}
              max={100_000}
              step={5_000}
              text={`${man(s.deliveryCost)}원`}
              onChange={(v) => patch({ deliveryCost: v })}
            />
          </div>
        )}
      </Block>

      <Block label="메인에 넣을 고기·생선" hint="고른 것 중에서 돌아가며 나와요">
        <div className="flex flex-wrap gap-1.5">
          {PROTEINS.map((k) => (
            <Chip
              key={k}
              on={s.proteins.includes(k)}
              onClick={() => {
                const next = toggle(s.proteins, k)
                if (next.length) patch({ proteins: next })
              }}
            >
              {PROTEIN_NAME[k]}
            </Chip>
          ))}
        </div>
      </Block>

      <Block label="못 먹는 재료 빼기" hint="알레르기·싫어하는 재료는 장보기와 식단에서 빠져요">
        <div className="flex flex-wrap gap-1.5">
          {[...new Set([...EXCLUDE_CHIPS, ...s.exclude])].map((w) => {
            const on = s.exclude.includes(w)
            return (
              <button
                key={w}
                onClick={() => patch({ exclude: toggle(s.exclude, w) })}
                aria-pressed={on}
                className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-[14px] font-bold ${
                  on ? 'border-danger bg-red-50 text-danger' : 'border-line text-sub'
                }`}
              >
                {on && <X size={13} />}
                {w}
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTyped()}
            placeholder="직접 쓰기 (예: 가지)"
            className="h-10 min-w-0 flex-1 rounded-btn border border-line px-3 text-[14px]"
          />
          <button onClick={addTyped} className="rounded-btn border border-line px-4 text-[14px] font-bold text-sub">
            빼기
          </button>
        </div>
      </Block>

      {/* 미리 계산 */}
      <div className="mt-6 space-y-1.5 rounded-2xl bg-bg px-4 py-4 text-[14px]">
        <p className="text-ink">
          장보기 주 {pv.trips}번 × {man(s.tripBudget)}원 = <b>{man(pv.shop)}원</b>{' '}
          {pv.fits ? (
            <span className="font-bold text-green-700">
              <Check size={14} className="inline" /> 한 주 안에 들어와요
            </span>
          ) : (
            <span className="font-bold text-danger">한 주 {man(s.weekBudget)}원보다 많아요</span>
          )}
        </p>
        <p className="text-ink">
          한 달이면 집밥 {man(pv.monthHome)}
          {pv.monthDelivery ? ` + 외식 ${man(pv.monthDelivery)}` : ''} = <b>약 {man(pv.month)}원</b>
        </p>
        {b && b.planned > 0 && (
          <p className="flex items-center gap-1 text-sub">
            <Wallet size={14} />
            가계부 식비 예산 {man(b.planned)}원 →{' '}
            {b.planned >= pv.month ? `${man(b.planned - pv.month)}원 여유` : `${man(pv.month - b.planned)}원 모자라요`}
          </p>
        )}
      </div>

      <button onClick={save} className="mt-5 w-full rounded-btn bg-ink py-4 text-[16px] font-bold text-white">
        이 기준으로 식단 짜기
      </button>
      <p className="mt-2 text-center text-[12px] text-cap">
        {p.ledger.linked
          ? p.shared
            ? '우리집 가계부에 저장돼 배우자 폰에서도 같아요'
            : '지금은 이 폰에 저장돼요'
          : '이 폰에 저장돼요'}
      </p>
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-3.5">
      <span>
        <span className="block text-[16px] font-bold text-ink">{label}</span>
        {hint && <span className="block text-[12px] text-cap">{hint}</span>}
      </span>
      {children}
    </div>
  )
}

function Block({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-4">
      <p className="text-[16px] font-bold text-ink">{label}</p>
      {hint && <p className="mb-2 text-[12px] text-cap">{hint}</p>}
      <div className={hint ? '' : 'mt-2'}>{children}</div>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full border px-3.5 py-1.5 text-[14px] font-bold ${
        on ? 'border-ink bg-ink text-white' : 'border-line text-sub'
      }`}
    >
      {children}
    </button>
  )
}

function Stepper({
  value,
  min,
  max,
  step = 1,
  text,
  onChange,
}: {
  value: number
  min: number
  max: number
  step?: number
  text: string
  onChange: (v: number) => void
}) {
  return (
    <span className="flex shrink-0 items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        aria-label="줄이기"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-ink"
      >
        <Minus size={16} />
      </button>
      <span className="tnum min-w-[58px] text-center text-[16px] font-extrabold text-ink">{text}</span>
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        aria-label="늘리기"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-bg text-ink"
      >
        <Plus size={16} />
      </button>
    </span>
  )
}
