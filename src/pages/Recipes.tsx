import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import OneTeamCard from '../components/OneTeamCard'
import ShareMore from '../components/ShareMore'
import SiteFooter from '../components/SiteFooter'
import {
  BASE_SERVINGS,
  DAILY,
  INGREDIENTS,
  RECIPES,
  SERVING_OPTIONS,
  ingredientsFor,
  mealCost,
  mealNutrition,
  recipeBySlug,
  amountText,
  type Recipe,
  type UnitPrices,
} from '../lib/recipes'
import {
  fetchRecipePrices,
  pricesDate,
  unitPrices,
  type IngredientPrice,
} from '../lib/recipePrices'

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
/** 12,520 → "1만 2,500원" — 큰 숫자는 백 원 단위로 */
const wonShort = (n: number) => {
  const r = Math.round(n / 100) * 100
  const man = Math.floor(r / 10_000)
  const rest = r % 10_000
  if (!man) return `${rest.toLocaleString('ko-KR')}원`
  return rest ? `${man}만 ${rest.toLocaleString('ko-KR')}원` : `${man}만 원`
}
const PEOPLE_KEY = 'moabuli.recipes.people'

function readPeople(): number {
  try {
    const n = Number(localStorage.getItem(PEOPLE_KEY))
    return (SERVING_OPTIONS as readonly number[]).includes(n) ? n : 4
  } catch {
    return 4
  }
}

/**
 * 결영이네 집밥 레시피 (2026-11-01) — 로그인 없이 열리는 공개 페이지.
 * 사진 크게, 글 적게 (2026-11-01 "별로다" → 만개의레시피·우리의식탁 따라 다시).
 * 제일 중요한 두 가지: 한 끼 얼마(쿠팡 가격, 쓴 만큼만) · 영양소(식약처 음식 DB).
 * /recipes = 목록, /recipes/:slug = 한 가지 레시피.
 */
export default function Recipes() {
  const { slug } = useParams()
  const [people, setPeopleState] = useState(readPeople)
  const setPeople = (n: number) => {
    setPeopleState(n)
    try {
      localStorage.setItem(PEOPLE_KEY, String(n))
    } catch {
      /* 시크릿 모드 */
    }
  }
  const [rows, setRows] = useState<IngredientPrice[]>([])
  useEffect(() => {
    fetchRecipePrices()
      .then(setRows)
      .catch(() => setRows([]))
  }, [])
  const prices = useMemo(() => unitPrices(rows), [rows])
  const recipe = slug ? recipeBySlug(slug.replace(/\/+$/, '')) : undefined

  return (
    <div className="flex min-h-screen justify-center bg-white break-keep">
      <div className="w-full max-w-app">
        {recipe ? (
          <Detail
            recipe={recipe}
            people={people}
            setPeople={setPeople}
            prices={prices}
            rows={rows}
          />
        ) : (
          <List people={people} setPeople={setPeople} prices={prices} />
        )}

        {/* 끝부분 순서: 다른 자료 → 원팀프로젝트 → 자료 출처 */}
        <div className="space-y-4 bg-bg px-4 pb-10 pt-8">
          <ShareMore />
          <OneTeamCardLink />
          <Sources date={pricesDate(rows)} recipe={recipe} />
        </div>
        <SiteFooter />
      </div>
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

function List({
  people,
  setPeople,
  prices,
}: {
  people: number
  setPeople: (n: number) => void
  prices: UnitPrices
}) {
  const navigate = useNavigate()
  return (
    <div className="px-4 pb-6 pt-7">
      <p className="text-[13px] font-bold text-brand">결영이네 집밥</p>
      <h1 className="mt-1 text-[26px] font-extrabold leading-snug text-ink">
        오늘 저녁, 한 끼 얼마?
      </h1>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[14px] text-sub">우리 집은</span>
        <People people={people} setPeople={setPeople} />
      </div>

      <ul className="mt-5 space-y-7">
        {RECIPES.map((r) => {
          const cost = mealCost(r, people, prices)
          return (
            <li key={r.slug}>
              <button
                onClick={() => {
                  navigate(`/recipes/${r.slug}`)
                  window.scrollTo(0, 0)
                }}
                className="block w-full text-left active:opacity-80"
              >
                <img
                  src={r.photo.src}
                  alt={r.name}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-2xl bg-bg object-cover"
                />
                <p className="mt-2.5 text-[18px] font-extrabold text-ink">{r.name}</p>
                <p className="mt-0.5 text-[15px] text-sub">
                  {cost.total !== null ? (
                    <b className="font-bold text-ink">
                      {people}인 {wonShort(cost.total)}
                    </b>
                  ) : (
                    <span className="text-cap">가격 받는 중</span>
                  )}
                  <span className="text-cap"> · {r.minutes}분</span>
                </p>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Detail({
  recipe: r,
  people,
  setPeople,
  prices,
  rows,
}: {
  recipe: Recipe
  people: number
  setPeople: (n: number) => void
  prices: UnitPrices
  rows: IngredientPrice[]
}) {
  const navigate = useNavigate()
  const cost = mealCost(r, people, prices)
  const n = mealNutrition(r)
  const links = Object.fromEntries(rows.map((x) => [x.ingredient, x.productUrl]))

  return (
    <article>
      {/* 사진 — 화면 꽉 차게, 뒤로 버튼은 사진 위에 */}
      <div className="relative">
        <img src={r.photo.src} alt={r.name} className="aspect-[4/3] w-full bg-bg object-cover" />
        <button
          onClick={() => navigate('/recipes')}
          aria-label="집밥 레시피 전체"
          className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink shadow"
        >
          <ChevronLeft size={22} />
        </button>
      </div>

      <div className="px-5 pt-5">
        <h1 className="text-[26px] font-extrabold text-ink">{r.name}</h1>
        <p className="mt-1 text-[15px] text-sub">{r.sub}</p>

        {/* 한 끼 얼마 — 숫자 하나만 크게 */}
        <div className="mt-5 flex items-end justify-between border-y border-line py-4">
          <div>
            <p className="text-[13px] text-cap">{people}인 한 끼</p>
            <p className="tnum text-[30px] font-extrabold leading-tight text-ink">
              {cost.total !== null ? wonShort(cost.total) : '—'}
            </p>
            <p className="text-[13px] text-cap">
              {cost.perPerson !== null
                ? `한 사람 ${won(cost.perPerson)}${r.withRice ? ' · 밥 포함' : ''}`
                : '가격 받는 중'}
            </p>
          </div>
          <People people={people} setPeople={setPeople} />
        </div>

        {/* 영양소 — 숫자 네 칸, 나트륨만 % */}
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

        {/* 재료 — 이름 · 양, 두 칸 */}
        <Part title="재료" right={`${people}인분`}>
          <ul>
            {ingredientsFor(r, people).map(([id, amount]) => {
              const url = links[id]
              return (
                <li
                  key={id}
                  className="flex items-center justify-between border-b border-line py-3 text-[16px]"
                >
                  <span className="text-ink">{INGREDIENTS[id]?.name}</span>
                  <span className="flex items-center gap-2.5">
                    <span className="text-sub">{amountText(id, amount)}</span>
                    {url && (
                      <a
                        href={url}
                        target="_blank"
                        rel="sponsored noopener noreferrer"
                        className="rounded-full border border-line px-2.5 py-0.5 text-[12px] font-bold text-sub"
                      >
                        구매
                      </a>
                    )}
                  </span>
                </li>
              )
            })}
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
          · 재료 가격 — 쿠팡 검색 결과{date ? ` (${date} 기준)` : ''}. 한 봉지 값을 1g(ml·개)당으로
          나눠 쓴 만큼만 더했어요. 가격은 수시로 바뀌어요
        </li>
        <li>
          · 영양소 — 식품의약품안전처 「전국통합식품영양성분정보(음식) 표준데이터」(공공데이터포털).
          음식 100g(ml)당 값에 1인분 양을 곱했어요. 나트륨 하루 기준 2,000mg
        </li>
        <li>· 레시피 — 흔한 집밥을 집에서 하기 쉽게 정리했어요</li>
        <li>
          · 사진 — 위키미디어 공용(Commons).{' '}
          {(recipe ? [recipe] : RECIPES).map((r, i) => (
            <span key={r.slug}>
              {i > 0 && ', '}
              <a
                href={r.photo.page}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {r.name}
              </a>{' '}
              {r.photo.author} ({r.photo.license})
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
