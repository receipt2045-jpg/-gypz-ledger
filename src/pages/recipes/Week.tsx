import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ChevronRight, RefreshCw, SlidersHorizontal, Wallet } from 'lucide-react'
import { DAY_NAMES, budgetPreview, portionsOf, tripDays, tripShopping, type Meal } from '../../lib/mealPlan'
import { INGREDIENTS, PROTEIN_NAME, amountText, recipeBySlug, type Recipe } from '../../lib/recipes'
import { Back, Bar, Dish, Part, RoleTag, Tabs, man, won, wonShort } from './ui'
import type { Planner } from './usePlanner'

const go = (navigate: ReturnType<typeof useNavigate>, to: string) => {
  navigate(to)
  window.scrollTo(0, 0)
}

/** 장보기 묶음 이름 — ① ② ③ */
const CIRCLED = ['①', '②', '③', '④']
const dayRange = (days: number[]) => days.map((d) => DAY_NAMES[d]).join(' ')

/** /recipes — 이번 주 집밥 */
export function Week({ p }: { p: Planner }) {
  const navigate = useNavigate()
  const { settings: s, plan, packs } = p
  const trips = tripDays(s)
  const costs = trips.map((days) => tripShopping(days.map((d) => plan[d]), s, packs).total ?? 0)
  const weekTotal = costs.reduce((a, b) => a + b, 0)
  const preview = budgetPreview(s)
  const tripOf = (d: number) => trips.findIndex((t) => t.includes(d))

  return (
    <>
      <Tabs at="week" />
      <div className="px-4 pb-6 pt-6">
        <p className="text-[13px] font-bold text-brand">결영이네 집밥</p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h1 className="text-[25px] font-extrabold leading-snug text-ink">이번 주 집밥</h1>
          <button
            onClick={() => go(navigate, '/recipes/setup')}
            className="mt-1.5 flex shrink-0 items-center gap-1 rounded-full border border-line px-3 py-1.5 text-[13px] font-bold text-sub"
          >
            <SlidersHorizontal size={14} />
            기준 바꾸기
          </button>
        </div>
        <p className="mt-0.5 text-[14px] text-sub">
          우리집 기준 · 한 주 {man(s.weekBudget)}원 · 한 번 {man(s.tripBudget)}원 ·{' '}
          {s.interval === 7 ? '일주일에 한 번' : `${s.interval}일마다`}
        </p>

        {!p.hasSettings && (
          <button
            onClick={() => go(navigate, '/recipes/setup')}
            className="mt-4 flex w-full items-center justify-between rounded-2xl bg-brand px-4 py-3.5 text-left text-white"
          >
            <span>
              <span className="block text-[16px] font-extrabold">우리집 식비 기준부터 정해요</span>
              <span className="block text-[13px] text-white/80">식구·한 주 얼마·못 먹는 재료 — 1분이면 돼요</span>
            </span>
            <ChevronRight size={20} />
          </button>
        )}

        {/* 돈 — 이번 주, 그리고 가계부 이번 달 식비 */}
        <div className="mt-4 space-y-3 rounded-2xl bg-bg px-4 py-4">
          <div>
            <div className="flex justify-between text-[14px]">
              <span className="font-bold text-ink">이번 주 장보기</span>
              <span className="tnum text-sub">
                <b className="text-ink">{wonShort(weekTotal)}</b> / {man(s.weekBudget)}원
              </span>
            </div>
            <div className="mt-1.5">
              <Bar value={weekTotal} max={s.weekBudget} />
            </div>
            {s.deliveryDays.length > 0 && (
              <p className="mt-1 text-[12px] text-cap">
                배달 {s.deliveryDays.length}번({wonShort(s.deliveryDays.length * s.deliveryCost)})은 따로예요
              </p>
            )}
          </div>
          <LedgerLine p={p} />
        </div>
        {!preview.fits && (
          <p className="mt-2 text-[13px] text-danger">
            장보기 {preview.trips}번 × {man(s.tripBudget)}원이 한 주 {man(s.weekBudget)}원보다 많아요. 기준을
            한 번 봐 주세요.
          </p>
        )}

        {/* 요일별 한 상 */}
        <ul className="mt-6 space-y-3">
          {plan.map((meal, d) => {
            const t = tripOf(d)
            const firstOfTrip = t >= 0 && trips[t][0] === d
            return (
              <li key={d}>
                {firstOfTrip && (
                  <button
                    onClick={() => go(navigate, `/recipes/shop?t=${t}`)}
                    className="mb-2 mt-3 flex w-full items-center justify-between rounded-xl bg-orange-50 px-3.5 py-2.5 text-left"
                  >
                    <span className="text-[14px] font-extrabold text-orange-800">
                      장보기 {CIRCLED[t]} · {dayRange(trips[t])}
                    </span>
                    <span className="flex items-center gap-0.5 text-[13px] font-bold text-orange-800">
                      <span className="tnum">
                        {wonShort(costs[t])} / {man(s.tripBudget)}
                      </span>
                      <ChevronRight size={16} />
                    </span>
                  </button>
                )}
                {meal ? (
                  <DayRow day={d} meal={meal} onSwap={() => p.swap(d)} />
                ) : t < 0 ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-3">
                    <span className="w-6 text-[15px] font-extrabold text-ink">{DAY_NAMES[d]}</span>
                    <span className="text-[14px] text-sub">배달 먹는 날 · {wonShort(s.deliveryCost)}</span>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-line px-4 py-3 text-[14px] text-sub">
                    {DAY_NAMES[d]} · 기준에 맞는 반찬이 모자라요. 못 먹는 재료를 줄여 보세요.
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={() => go(navigate, '/recipes/shop?t=0')}
            className="rounded-btn bg-ink py-3.5 text-[15px] font-bold text-white"
          >
            장보기 목록
          </button>
          <button
            onClick={p.regenerate}
            className="flex items-center justify-center gap-1.5 rounded-btn border border-line py-3.5 text-[15px] font-bold text-sub"
          >
            <RefreshCw size={15} />
            식단 새로 짜기
          </button>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-cap">
          한 상은 메인(고기·생선) 1 + 서브 1 + 국 1이에요. 제철 재료를 먼저 고르고, 반찬은 그날 다 먹게 식구
          수만큼({portionsOf(s)}인분)만 잡았어요.
        </p>
      </div>
    </>
  )
}

function DayRow({ day, meal, onSwap }: { day: number; meal: Meal; onSwap: () => void }) {
  const navigate = useNavigate()
  const dishes = [meal.main, meal.sub, meal.soup].map(recipeBySlug).filter((r): r is Recipe => !!r)
  const main = dishes[0]
  return (
    <div className="rounded-2xl border border-line px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-extrabold text-ink">
          {DAY_NAMES[day]}
          {main?.protein && (
            <span className="ml-1.5 text-[12px] font-bold text-cap">{PROTEIN_NAME[main.protein]}</span>
          )}
        </span>
        <button onClick={onSwap} className="flex items-center gap-1 text-[12px] font-bold text-cap">
          <RefreshCw size={12} />이 날만 바꾸기
        </button>
      </div>
      <ul className="mt-2 space-y-1.5">
        {dishes.map((r) => (
          <li key={r.slug}>
            <button
              onClick={() => go(navigate, `/recipes/${r.slug}`)}
              className="flex w-full items-center gap-2 text-left"
            >
              <RoleTag role={r.role} />
              <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{r.name}</span>
              <ChevronRight size={15} className="shrink-0 text-cap" />
            </button>
          </li>
        ))}
      </ul>
      {!meal.soup && <p className="mt-1.5 text-[12px] text-cap">국물 있는 메인이라 국은 따로 안 끓여요</p>}
    </div>
  )
}

/** 가계부 이번 달 식비 한 줄 — 로그인 안 했으면 안내 */
function LedgerLine({ p }: { p: Planner }) {
  const navigate = useNavigate()
  const b = p.ledger.budget
  if (!p.ledger.checked) return null
  if (!b)
    return (
      <button onClick={() => go(navigate, '/')} className="flex w-full items-center gap-1.5 text-left text-[13px] text-sub">
        <Wallet size={14} />
        모아불리 가계부를 쓰면 이번 달 식비가 여기 같이 떠요
        <ChevronRight size={14} />
      </button>
    )
  const [, m] = b.ym.split('-').map(Number)
  return (
    <div>
      <div className="flex justify-between text-[14px]">
        <span className="flex items-center gap-1 font-bold text-ink">
          <Wallet size={14} />
          {m}월 식비 (내 가계부)
        </span>
        <span className="tnum text-sub">
          <b className="text-ink">{man(b.spent)}</b>
          {b.planned ? ` / ${man(b.planned)}원` : '원 씀'}
        </span>
      </div>
      {b.planned > 0 ? (
        <>
          <div className="mt-1.5">
            <Bar value={b.spent} max={b.planned} tone="green" />
          </div>
          <p className="mt-1 text-[12px] text-cap">
            {b.planned >= b.spent ? `남은 식비 ${wonShort(b.planned - b.spent)}` : `${wonShort(b.spent - b.planned)} 넘었어요`}
          </p>
        </>
      ) : (
        <p className="mt-1 text-[12px] text-cap">가계부 예산 표에 식비 예산을 넣으면 남은 돈도 보여요</p>
      )}
    </div>
  )
}

/** /recipes/shop?t=0 — 장보기 한 번 목록 + 그 재료로 차리는 한 상 */
export function Shop({ p }: { p: Planner }) {
  const navigate = useNavigate()
  const [q] = useSearchParams()
  const { settings: s, plan, packs, estimated } = p
  const trips = tripDays(s)
  const t = Math.min(Math.max(0, Number(q.get('t')) || 0), Math.max(0, trips.length - 1))
  const days = trips[t] ?? []
  const list = tripShopping(days.map((d) => plan[d]), s, packs)
  const total = list.total ?? 0
  const [checked, setChecked] = useState<string[]>([])
  const shelves = [
    ['meat', '고기·생선'],
    ['veg', '채소'],
    ['etc', '그 밖에'],
  ] as const
  const anyEstimate = list.toBuy.some((it) => estimated.has(it.id))

  return (
    <div className="px-4 pb-6 pt-5">
      <Back to="/recipes" label="이번 주 집밥" />
      <h1 className="mt-3 text-[24px] font-extrabold text-ink">이번 주 장보기</h1>

      {trips.length > 1 && (
        <div className="mt-3 flex gap-1.5">
          {trips.map((ds, i) => (
            <button
              key={i}
              onClick={() => navigate(`/recipes/shop?t=${i}`, { replace: true })}
              aria-pressed={i === t}
              className={`flex-1 rounded-btn border py-2 text-[13px] font-bold ${
                i === t ? 'border-ink bg-ink text-white' : 'border-line text-sub'
              }`}
            >
              {CIRCLED[i]} {DAY_NAMES[ds[0]]}요일
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-2xl bg-ink px-5 py-4 text-white">
        <p className="text-[13px] text-white/60">
          장보기 {CIRCLED[t]} · {dayRange(days)} · {s.adults + s.kids}식구
        </p>
        <p className="tnum text-[30px] font-extrabold leading-tight">
          {anyEstimate ? '약 ' : ''}
          {wonShort(total)}
        </p>
        <div className="mt-2">
          <Bar value={total} max={s.tripBudget} />
        </div>
        <p className="mt-1 text-[13px] text-white/75">
          {total <= s.tripBudget
            ? `${man(s.tripBudget)}원 중 ${wonShort(s.tripBudget - total)} 남아요`
            : `${man(s.tripBudget)}원보다 ${wonShort(total - s.tripBudget)} 많아요 — 이번 주 집밥에서 한 날을 바꿔 보세요`}
        </p>
      </div>

      {shelves.map(([shelf, label]) => {
        const items = list.toBuy.filter((it) => (INGREDIENTS[it.id]?.shelf ?? 'etc') === shelf)
        if (!items.length) return null
        return (
          <Part key={shelf} title={label} right={`${items.length}가지`}>
            <ul>
              {items.map((it) => {
                const on = checked.includes(it.id)
                return (
                  <li key={it.id} className="border-b border-line">
                    <label className="flex cursor-pointer items-center gap-3 py-3">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setChecked(on ? checked.filter((x) => x !== it.id) : [...checked, it.id])}
                        className="h-5 w-5 shrink-0 accent-[#191F28]"
                      />
                      <span className={`min-w-0 flex-1 ${on ? 'text-cap line-through' : ''}`}>
                        <span className="block text-[16px] text-ink">{INGREDIENTS[it.id]?.name}</span>
                        <span className="block text-[12px] text-cap">
                          {amountText(it.id, it.need)} 써요{it.packs > 1 ? ` · ${it.packs}개` : ''}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-[15px] font-bold text-ink">
                        {it.cost !== null ? won(it.cost) : '—'}
                      </span>
                      {it.url && (
                        <a
                          href={it.url}
                          target="_blank"
                          rel="sponsored noopener noreferrer"
                          className="shrink-0 rounded-full border border-line px-2.5 py-0.5 text-[12px] font-bold text-sub"
                        >
                          구매
                        </a>
                      )}
                    </label>
                  </li>
                )
              })}
            </ul>
          </Part>
        )
      })}
      <p className="mt-3 flex items-center gap-1 text-[13px] text-sub">
        <Check size={14} />
        간장·된장·참기름 같은 양념과 쌀은 집에 있다고 보고 뺐어요
        {s.exclude.length ? ` · ${s.exclude.join('·')} 뺌` : ''}
      </p>
      {anyEstimate && (
        <p className="mt-1 text-[12px] text-cap">
          「약」 붙은 값은 마트·쿠팡 흔한 값을 어림한 거예요. 실제 값은 가게마다 달라요.
        </p>
      )}

      <RecordButton p={p} amount={total} label={`장보기 ${CIRCLED[t]} (${dayRange(days)})`} />

      <Part title="이 재료로 차리는 한 상" right={`${days.length}일`}>
        <ul className="space-y-4">
          {days.map((d) => {
            const meal = plan[d]
            if (!meal) return null
            return (
              <li key={d}>
                <p className="mb-1.5 text-[14px] font-extrabold text-ink">{DAY_NAMES[d]}요일</p>
                <div className="grid grid-cols-3 gap-2">
                  {[meal.main, meal.sub, meal.soup].map((slug) => {
                    const r = recipeBySlug(slug)
                    if (!r) return null
                    return (
                      <button key={slug} onClick={() => go(navigate, `/recipes/${slug}`)} className="text-left">
                        <Dish r={r} className="aspect-square w-full rounded-xl" />
                        <span className="mt-1 block">
                          <RoleTag role={r.role} />
                        </span>
                        <span className="mt-0.5 block text-[13px] font-bold leading-snug text-ink">{r.name}</span>
                      </button>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
      </Part>
    </div>
  )
}

/** 장 본 돈 가계부에 적기 — 로그인한 사람만. 실제로 낸 돈으로 고쳐서 적는다 */
function RecordButton({ p, amount, label }: { p: Planner; amount: number; label: string }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'fail'>('idle')
  const [error, setError] = useState('')

  if (!p.ledger.checked) return null
  if (!p.ledger.linked)
    return (
      <button
        onClick={() => go(navigate, '/')}
        className="mt-5 w-full rounded-btn border border-line py-3.5 text-[14px] font-bold text-sub"
      >
        모아불리 가계부에 장 본 돈 적기 — 로그인하고 쓰기
      </button>
    )
  if (state === 'done')
    return (
      <p className="mt-5 rounded-btn bg-green-50 py-3.5 text-center text-[15px] font-bold text-green-700">
        가계부 식비에 적었어요
      </p>
    )
  if (!open)
    return (
      <button
        onClick={() => {
          setValue(String(Math.round(amount / 100) * 100))
          setOpen(true)
        }}
        className="mt-5 w-full rounded-btn bg-brand py-3.5 text-[15px] font-bold text-white"
      >
        장 본 돈 가계부에 적기
      </button>
    )
  const submit = async () => {
    const n = Number(value.replace(/[^\d]/g, ''))
    if (!n || n <= 0) {
      setError('실제로 낸 돈을 넣어 주세요')
      return
    }
    setState('saving')
    try {
      await p.ledger.record(n, `집밥 ${label}`)
      setState('done')
    } catch {
      setState('fail')
    }
  }
  return (
    <div className="mt-5 rounded-2xl border border-line px-4 py-4">
      <p className="text-[14px] font-bold text-ink">실제로 낸 돈</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError('')
          }}
          className="tnum h-11 min-w-0 flex-1 rounded-btn border border-line px-3 text-[17px] font-bold text-ink"
          aria-label="실제로 낸 돈(원)"
        />
        <span className="text-[15px] text-sub">원</span>
      </div>
      {error && <p className="mt-1 text-[13px] text-danger">{error}</p>}
      {state === 'fail' && <p className="mt-1 text-[13px] text-danger">못 적었어요. 잠시 뒤 다시 눌러 주세요.</p>}
      <p className="mt-2 text-[12px] text-cap">소비 기록 「식비」에 한 줄 들어가요. 예산 표는 그대로예요.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button onClick={() => setOpen(false)} className="rounded-btn border border-line py-3 text-[14px] font-bold text-sub">
          그만두기
        </button>
        <button
          onClick={submit}
          disabled={state === 'saving'}
          className="rounded-btn bg-brand py-3 text-[14px] font-bold text-white"
        >
          {state === 'saving' ? '적는 중…' : '적기'}
        </button>
      </div>
    </div>
  )
}
