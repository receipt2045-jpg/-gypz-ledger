import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import OneTeamCard from '../components/OneTeamCard'
import ShareMore from '../components/ShareMore'
import SiteFooter from '../components/SiteFooter'
import {
  BASE_SERVINGS,
  DAILY,
  INGREDIENTS,
  MAIN_INGREDIENTS,
  PANTRY,
  RECIPES,
  SERVING_OPTIONS,
  amountText,
  ingredientsFor,
  mealNutrition,
  recipeBySlug,
  recipesWith,
  shoppingList,
  type Pack,
  type Recipe,
} from '../lib/recipes'
import { fetchRecipePrices, packsOf, pricesDate, type IngredientPrice } from '../lib/recipePrices'
import { reelById } from '../lib/reels'
import { Week, Shop } from './recipes/Week'
import { Setup } from './recipes/Setup'
import { Season } from './recipes/Season'
import { Reel } from './recipes/Reel'
import { usePlanner } from './recipes/usePlanner'
import { Dish, KidTag, RoleTag, Tabs } from './recipes/ui'

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
/** 12,520 → "1만 2,500원" — 큰 숫자는 백 원 단위로 */
const wonShort = (n: number) => {
  const r = Math.round(n / 100) * 100
  const man = Math.floor(r / 10_000)
  const rest = r % 10_000
  if (!man) return `${rest.toLocaleString('ko-KR')}원`
  return rest ? `${man}만 ${rest.toLocaleString('ko-KR')}원` : `${man}만 원`
}

/** 재료 칩 그림 */
const CHIP_EMOJI: Record<string, string> = {
  pork: '🥩',
  kimchi: '🥬',
  tofu: '🧈',
  egg: '🥚',
  potato: '🥔',
}
const CHIP_NAME: Record<string, string> = {
  pork: '돼지고기',
  kimchi: '김치',
  tofu: '두부',
  egg: '달걀',
  potato: '감자',
}

// ── 이 폰에 기억해 두기 — 장 보러 가서 다시 열어도 그대로 ──
const KEY = {
  people: 'moabuli.recipes.people',
  owned: 'moabuli.recipes.owned',
  cart: 'moabuli.recipes.cart',
}

function load<T>(key: string, fallback: T, ok: (v: unknown) => boolean): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null')
    return ok(v) ? (v as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* 시크릿 모드 */
  }
}
function useSaved<T>(key: string, fallback: T, ok: (v: unknown) => boolean) {
  const [v, setV] = useState<T>(() => load(key, fallback, ok))
  const set = (next: T) => {
    setV(next)
    save(key, next)
  }
  return [v, set] as const
}
const isStrings = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string')

/**
 * 결영이네 집밥 레시피 (2026-11-01) — 로그인 없이 열리는 공개 페이지.
 * "집에 뭐 있어요?" → 그 재료로 되는 레시피 → 담기 → 추가로 살 재료만 봉지 단위로.
 * 3일에 한 번 장 보는 집을 생각했다: 레시피 셋을 담으면 그게 사흘 장보기 목록이다.
 * /recipes = 고르기, /recipes/cart = 장보기 목록, /recipes/:slug = 한 가지 레시피.
 *
 * 2026-11-26 집밥 플래너로 키움 (결영 확정, 링크 하나):
 * /recipes = 이번 주 집밥(우리집 기준으로 짠 일주일 한 상), /recipes/setup = 우리집 식비 기준,
 * /recipes/shop?t=0 = 장보기 한 번 목록, /recipes/season = 제철 달력, /recipes/reel-1123 = 릴스 편,
 * /recipes/all = 레시피 전체(재료로 고르기), /recipes/cart = 담은 레시피 장보기.
 */
export default function Recipes() {
  const { slug } = useParams()
  const [people, setPeople] = useSaved<number>(KEY.people, 4, (v) =>
    (SERVING_OPTIONS as readonly unknown[]).includes(v),
  )
  const [owned, setOwned] = useSaved<string[]>(KEY.owned, [], isStrings)
  const [cart, setCart] = useSaved<string[]>(KEY.cart, [], isStrings)
  const toggleCart = (s: string) =>
    setCart(cart.includes(s) ? cart.filter((x) => x !== s) : [...cart, s])

  const [rows, setRows] = useState<IngredientPrice[]>([])
  useEffect(() => {
    fetchRecipePrices()
      .then(setRows)
      .catch(() => setRows([]))
  }, [])
  const packs = useMemo(() => packsOf(rows), [rows])

  const page = slug?.replace(/\/+$/, '')
  const recipe = page ? recipeBySlug(page) : undefined
  const reel = page?.startsWith('reel-') ? reelById(page.slice(5)) : undefined
  const planner = usePlanner()

  return (
    <div className="flex min-h-screen justify-center bg-white break-keep">
      <div className="w-full max-w-app">
        {!page ? (
          <Week p={planner} />
        ) : page === 'setup' ? (
          <Setup p={planner} />
        ) : page === 'shop' ? (
          <Shop p={planner} />
        ) : page === 'season' ? (
          <Season month={planner.month} />
        ) : reel ? (
          <Reel ep={reel} p={planner} />
        ) : page === 'cart' ? (
          <Cart
            cart={cart}
            toggleCart={toggleCart}
            owned={owned}
            people={people}
            setPeople={setPeople}
            packs={packs}
          />
        ) : recipe ? (
          <Detail
            recipe={recipe}
            people={people}
            setPeople={setPeople}
            inCart={cart.includes(recipe.slug)}
            toggleCart={() => toggleCart(recipe.slug)}
            owned={owned}
            packs={packs}
          />
        ) : (
          <Pick
            owned={owned}
            setOwned={setOwned}
            people={people}
            setPeople={setPeople}
            cart={cart}
            toggleCart={toggleCart}
          />
        )}

        {/* 끝부분 순서: 다른 자료 → 원팀프로젝트 → 자료 출처 */}
        <div className="space-y-4 bg-bg px-4 pb-28 pt-8">
          <ShareMore />
          <OneTeamCardLink />
          <Sources date={pricesDate(rows)} recipe={recipe} />
        </div>
        <SiteFooter />
      </div>

      {(page === 'all' || recipe) && cart.length > 0 && <CartBar count={cart.length} />}
    </div>
  )
}

function OneTeamCardLink() {
  const navigate = useNavigate()
  return <OneTeamCard onStory={() => navigate('/story')} />
}

/** 2인 · 3인 · 4인 — 작은 알약 */
function People({ people, setPeople }: { people: number; setPeople: (n: number) => void }) {
  return (
    <div className="flex gap-1.5" role="group" aria-label="몇 명이 먹나요">
      {SERVING_OPTIONS.map((n) => (
        <button
          key={n}
          onClick={() => setPeople(n)}
          aria-pressed={people === n}
          className={`rounded-full px-3.5 py-1.5 text-[14px] font-bold ${
            people === n ? 'bg-ink text-white' : 'bg-bg text-sub'
          }`}
        >
          {n}인
        </button>
      ))}
    </div>
  )
}

/** 이 레시피를 하려면 더 사야 하는 재료 이름 — 집에 있다고 고른 것과 양념은 빼고 */
function extrasFor(r: Recipe, owned: string[]): string[] {
  return r.ingredients
    .map(([id]) => id)
    .filter((id) => !owned.includes(id) && !PANTRY.has(id))
    .map((id) => INGREDIENTS[id]?.name ?? id)
}

function Pick({
  owned,
  setOwned,
  people,
  setPeople,
  cart,
  toggleCart,
}: {
  owned: string[]
  setOwned: (v: string[]) => void
  people: number
  setPeople: (n: number) => void
  cart: string[]
  toggleCart: (s: string) => void
}) {
  const navigate = useNavigate()
  const list = recipesWith(owned)
  const toggleOwned = (id: string) =>
    setOwned(owned.includes(id) ? owned.filter((x) => x !== id) : [...owned, id])
  const open = (s: string) => {
    navigate(`/recipes/${s}`)
    window.scrollTo(0, 0)
  }

  return (
    <>
    <Tabs at="all" />
    <div className="px-4 pb-6 pt-6">
      <p className="text-[13px] font-bold text-brand">결영이네 집밥 레시피 {RECIPES.length}가지</p>
      <h1 className="mt-1 text-[26px] font-extrabold leading-snug text-ink">집에 뭐 있어요?</h1>
      <p className="mt-1 text-[15px] text-sub">고르면 그걸로 만드는 레시피만 보여 드려요.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {MAIN_INGREDIENTS.map((id) => {
          const on = owned.includes(id)
          return (
            <button
              key={id}
              onClick={() => toggleOwned(id)}
              aria-pressed={on}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-[15px] font-bold ${
                on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'
              }`}
            >
              <span aria-hidden>{CHIP_EMOJI[id]}</span>
              {CHIP_NAME[id]}
            </button>
          )
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <span className="text-[14px] text-sub">
          레시피 <b className="text-ink">{list.length}</b>개
        </span>
        <People people={people} setPeople={setPeople} />
      </div>

      <ul className="mt-4 space-y-7">
        {list.map((r) => {
          const inCart = cart.includes(r.slug)
          const extras = extrasFor(r, owned)
          return (
            <li key={r.slug}>
              <div className="relative">
                <button
                  onClick={() => open(r.slug)}
                  className="block w-full active:opacity-80"
                  aria-label={`${r.name} 보기`}
                >
                  <Dish r={r} className="aspect-[16/11] w-full rounded-2xl" />
                </button>
                <CartButton inCart={inCart} onClick={() => toggleCart(r.slug)} floating />
              </div>
              <button onClick={() => open(r.slug)} className="mt-2.5 block w-full text-left">
                <span className="flex items-center gap-1.5">
                  <span className="text-[18px] font-extrabold text-ink">{r.name}</span>
                  <RoleTag role={r.role} />
                  <KidTag r={r} />
                </span>
                <span className="mt-0.5 block text-[14px] text-sub">
                  {extras.length ? (
                    <>
                      <b className="font-bold text-ink">+ {extras.slice(0, 3).join('·')}</b>
                      {extras.length > 3 ? ` 외 ${extras.length - 3}가지` : ''} 사면 돼요
                    </>
                  ) : (
                    <b className="font-bold text-brand">더 살 것 없어요</b>
                  )}
                  <span className="text-cap"> · {r.minutes}분</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
    </>
  )
}

function CartButton({
  inCart,
  onClick,
  floating = false,
}: {
  inCart: boolean
  onClick: () => void
  floating?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={inCart}
      className={`flex items-center gap-1 rounded-full px-3.5 py-2 text-[14px] font-extrabold shadow ${
        floating ? 'absolute bottom-3 right-3' : ''
      } ${inCart ? 'bg-brand text-white' : 'bg-white text-ink'}`}
    >
      {inCart ? <Check size={16} /> : <Plus size={16} />}
      {inCart ? '담음' : '담기'}
    </button>
  )
}

/** 담은 게 있으면 화면 맨 아래에 붙는 바 */
function CartBar({ count }: { count: number }) {
  const navigate = useNavigate()
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-4 pb-4">
      <button
        onClick={() => {
          navigate('/recipes/cart')
          window.scrollTo(0, 0)
        }}
        className="flex w-full max-w-[448px] items-center justify-between rounded-2xl bg-ink px-5 py-4 text-white shadow-lg"
      >
        <span className="text-[16px] font-extrabold">{count}끼 담음</span>
        <span className="flex items-center gap-0.5 text-[15px] font-bold">
          장보기 목록 보기
          <ChevronRight size={18} />
        </span>
      </button>
    </div>
  )
}

function Cart({
  cart,
  toggleCart,
  owned,
  people,
  setPeople,
  packs,
}: {
  cart: string[]
  toggleCart: (s: string) => void
  owned: string[]
  people: number
  setPeople: (n: number) => void
  packs: Record<string, Pack>
}) {
  const navigate = useNavigate()
  const [withPantry, setWithPantry] = useState(false)
  const recipes = cart.map(recipeBySlug).filter((r): r is Recipe => !!r)
  const list = shoppingList(recipes, people, owned, withPantry, packs)
  const back = () => {
    navigate('/recipes/all')
    window.scrollTo(0, 0)
  }

  if (!recipes.length) {
    return (
      <div className="px-5 pb-10 pt-6">
        <BackLink onClick={back} />
        <h1 className="mt-4 text-[24px] font-extrabold text-ink">장보기 목록</h1>
        <p className="mt-2 text-[15px] text-sub">아직 담은 레시피가 없어요.</p>
        <button
          onClick={back}
          className="mt-5 w-full rounded-btn bg-ink py-3.5 text-[15px] font-bold text-white"
        >
          레시피 고르러 가기
        </button>
      </div>
    )
  }

  return (
    <div className="px-5 pb-6 pt-6">
      <BackLink onClick={back} />
      <h1 className="mt-4 text-[24px] font-extrabold text-ink">장보기 목록</h1>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[15px] text-sub">{recipes.length}끼 · 인원</span>
        <People people={people} setPeople={setPeople} />
      </div>

      {/* 합계 — 장 한 번에 실제로 내는 돈 */}
      <div className="mt-4 rounded-2xl bg-ink px-5 py-4 text-white">
        <p className="text-[13px] text-white/60">추가로 살 것 합계</p>
        <p className="tnum text-[30px] font-extrabold leading-tight">
          {list.total !== null ? wonShort(list.total) : '가격 받는 중'}
        </p>
        {list.total !== null && (
          <p className="mt-0.5 text-[14px] text-white/75">
            {recipes.length}끼로 나누면 한 끼 {wonShort(list.total / recipes.length)}
          </p>
        )}
      </div>

      <Part title="추가로 살 것" right={`${list.toBuy.length}가지`}>
        <ul>
          {list.toBuy.map((it) => (
            <li
              key={it.id}
              className="flex items-center justify-between gap-3 border-b border-line py-3"
            >
              <span className="min-w-0">
                <span className="block text-[16px] text-ink">{INGREDIENTS[it.id]?.name}</span>
                <span className="block text-[13px] text-cap">
                  {amountText(it.id, it.need)} 써요{it.packs > 1 ? ` · ${it.packs}개 사요` : ''}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2.5">
                <span className="tnum text-[15px] font-bold text-ink">
                  {it.cost !== null ? won(it.cost) : '—'}
                </span>
                {it.url && (
                  <a
                    href={it.url}
                    target="_blank"
                    rel="sponsored noopener noreferrer"
                    className="rounded-full border border-line px-2.5 py-0.5 text-[12px] font-bold text-sub"
                  >
                    구매
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
        <label className="mt-3 flex items-center gap-2 text-[14px] text-sub">
          <input
            type="checkbox"
            checked={withPantry}
            onChange={(e) => setWithPantry(e.target.checked)}
            className="h-4 w-4 accent-[#191F28]"
          />
          간장·설탕 같은 양념과 쌀도 사야 해요
        </label>
      </Part>

      {list.have.length > 0 && (
        <Part title="집에 있는 것" right="빼고 계산했어요">
          <div className="flex flex-wrap gap-1.5">
            {list.have.map((id) => (
              <span key={id} className="rounded-full bg-bg px-3 py-1 text-[13px] text-sub">
                {INGREDIENTS[id]?.name}
              </span>
            ))}
          </div>
        </Part>
      )}

      <Part title="담은 레시피" right={`${recipes.length}끼`}>
        <ul className="space-y-3">
          {recipes.map((r) => (
            <li key={r.slug} className="flex items-center gap-3">
              <button
                onClick={() => {
                  navigate(`/recipes/${r.slug}`)
                  window.scrollTo(0, 0)
                }}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <Dish r={r} className="h-14 w-14 shrink-0 rounded-xl" />
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-bold text-ink">{r.name}</span>
                  <span className="block text-[13px] text-cap">{r.minutes}분 · 순서 보기</span>
                </span>
              </button>
              <button
                onClick={() => toggleCart(r.slug)}
                aria-label={`${r.name} 빼기`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-sub"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={back}
          className="mt-4 w-full rounded-btn border border-line py-3 text-[14px] font-bold text-sub"
        >
          + 레시피 더 담기
        </button>
      </Part>
    </div>
  )
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="-ml-1 flex items-center gap-0.5 text-[14px] font-semibold text-sub"
    >
      <ChevronLeft size={19} />
      레시피
    </button>
  )
}

function Detail({
  recipe: r,
  people,
  setPeople,
  inCart,
  toggleCart,
  owned,
  packs,
}: {
  recipe: Recipe
  people: number
  setPeople: (n: number) => void
  inCart: boolean
  toggleCart: () => void
  owned: string[]
  packs: Record<string, Pack>
}) {
  const navigate = useNavigate()
  const n = mealNutrition(r)
  const extra = shoppingList([r], people, owned, false, packs)

  return (
    <article>
      {/* 사진 — 화면 꽉 차게, 뒤로 버튼은 사진 위에 */}
      <div className="relative">
        <Dish r={r} className="aspect-[4/3] w-full" />
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/recipes'))}
          aria-label="뒤로"
          className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow"
        >
          <ChevronLeft size={22} />
        </button>
        <CartButton inCart={inCart} onClick={toggleCart} floating />
      </div>

      <div className="px-5 pt-5">
        <div className="flex gap-1">
          <RoleTag role={r.role} />
          <KidTag r={r} />
        </div>
        <h1 className="mt-1.5 text-[26px] font-extrabold text-ink">{r.name}</h1>
        <p className="mt-1 text-[15px] text-sub">{r.sub}</p>
        {r.babyTip && (
          <div className="mt-4 rounded-2xl bg-pink-50 px-4 py-3 text-[14px] leading-relaxed text-pink-900">
            <b>아기 식판</b> · {r.babyTip}
          </div>
        )}
        {r.adultTip && (
          <p className="mt-2 text-[13px] text-sub">
            <b className="text-ink">어른만 매콤하게</b> · {r.adultTip}
          </p>
        )}

        {/* 더 사야 하는 돈 — 집에 있는 재료·양념은 빼고 */}
        <div className="mt-5 flex items-end justify-between border-y border-line py-4">
          <div>
            <p className="text-[13px] text-cap">
              {owned.length ? '집에 있는 재료 빼고 ' : ''}더 살 재료
            </p>
            <p className="tnum text-[28px] font-extrabold leading-tight text-ink">
              {extra.total !== null ? wonShort(extra.total) : '—'}
            </p>
            <p className="text-[13px] text-cap">
              {extra.toBuy.map((i) => INGREDIENTS[i.id]?.name).join('·') || '더 살 것 없어요'}
            </p>
          </div>
          <People people={people} setPeople={setPeople} />
        </div>

        {/* 영양소 — 숫자 네 칸, 나트륨만 % (식약처 값을 확인한 레시피만) */}
        {n && (
        <>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <Nut label="열량" value={`${Math.round(n.kcal)}`} unit="kcal" />
          <Nut label="탄수화물" value={`${Math.round(n.carb)}`} unit="g" />
          <Nut label="단백질" value={`${Math.round(n.protein)}`} unit="g" />
          <Nut
            label="나트륨"
            value={`${Math.round((n.sodium / DAILY.sodium) * 100)}`}
            unit="%"
            warn={n.sodium / DAILY.sodium >= 0.5}
          />
        </div>
        <p className="mt-2 text-center text-[12px] text-cap">
          한 사람 한 끼{r.withRice ? '(밥 한 공기 포함)' : ''} · 나트륨은 하루 권장량 대비
        </p>
        </>
        )}

        {/* 재료 — 이름 · 양 */}
        <Part title="재료" right={`${people}인분`}>
          <ul>
            {ingredientsFor(r, people).map(([id, amount]) => (
              <li
                key={id}
                className="flex items-center justify-between border-b border-line py-3 text-[16px]"
              >
                <span className="text-ink">
                  {INGREDIENTS[id]?.name}
                  {owned.includes(id) && (
                    <span className="ml-1.5 rounded bg-bg px-1.5 py-0.5 text-[11px] font-bold text-brand">
                      집에 있음
                    </span>
                  )}
                </span>
                <span className="text-sub">{amountText(id, amount)}</span>
              </li>
            ))}
          </ul>
        </Part>

        {/* 만드는 순서 */}
        <Part title="만드는 순서" right={`${r.minutes}분`}>
          {people !== BASE_SERVINGS && (
            <p className="mb-3 text-[13px] text-cap">
              물은 2인분 기준이에요. {people}인분이면 {people / BASE_SERVINGS}배로 넣어요.
            </p>
          )}
          <ol className="space-y-5">
            {r.steps.map((s, i) => (
              <li key={s} className="flex gap-3.5">
                <span className="text-[20px] font-extrabold leading-none text-brand">{i + 1}</span>
                <p className="text-[16px] leading-relaxed text-ink">{s}</p>
              </li>
            ))}
          </ol>
        </Part>
        <div className="h-8" />
      </div>
    </article>
  )
}

function Nut({
  label,
  value,
  unit,
  warn = false,
}: {
  label: string
  value: string
  unit: string
  warn?: boolean
}) {
  return (
    <div className="rounded-xl bg-bg py-3">
      <p className={`tnum text-[19px] font-extrabold ${warn ? 'text-danger' : 'text-ink'}`}>
        {value}
        <span className="text-[12px] font-bold">{unit}</span>
      </p>
      <p className="mt-0.5 text-[12px] text-cap">{label}</p>
    </div>
  )
}

function Part({ title, right, children }: { title: string; right: string; children: ReactNode }) {
  return (
    <section className="mt-9">
      <div className="mb-2 flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h2 className="text-[19px] font-extrabold text-ink">{title}</h2>
        <span className="text-[14px] text-sub">{right}</span>
      </div>
      {children}
    </section>
  )
}

function Sources({ date, recipe }: { date: string | null; recipe?: Recipe }) {
  return (
    <div className="px-1 pt-2 text-[12px] leading-relaxed text-cap">
      <p className="font-semibold text-sub">자료 출처</p>
      <ul className="mt-1.5 space-y-1">
        <li>
          · 재료 가격 — 쿠팡 검색 결과{date ? ` (${date} 기준)` : ''}. 같은 용량 중 1g(ml·개)당 가장
          싼 상품이에요. 가격은 수시로 바뀌어요
        </li>
        <li>
          · 영양소 — 식품의약품안전처 「전국통합식품영양성분정보(음식) 표준데이터」(공공데이터포털).
          음식 100g(ml)당 값에 1인분 양을 곱했어요. 나트륨 하루 기준 2,000mg
        </li>
        <li>
          · 레시피 — 흔한 집밥을 집에서 하기 쉽게 새로 썼어요. 다른 레시피 사이트의 글·사진은 옮기지 않았어요
        </li>
        <li>
          · 「약」 붙은 재료값 — 2026년 11월 마트·쿠팡 흔한 값을 어림한 거예요. 실제 값은 가게마다 달라요
        </li>
        <li>· 제철 재료 — 흔히 그 달에 많이 나고 값이 내려가는 재료예요. 지역·날씨에 따라 달라요</li>
        <li>
          · 사진 — 위키미디어 공용(Commons).{' '}
          {(recipe ? [recipe] : RECIPES).filter((r) => r.photo).map((r, i) => (
            <span key={r.slug}>
              {i > 0 && ', '}
              <a
                href={r.photo!.page}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {r.name}
              </a>{' '}
              {r.photo!.author} ({r.photo!.license})
            </span>
          ))}
        </li>
      </ul>
      <p className="mt-3">
        이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </p>
    </div>
  )
}
