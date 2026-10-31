import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import OneTeamCard from '../components/OneTeamCard'
import ShareMore from '../components/ShareMore'
import SiteFooter from '../components/SiteFooter'
import {
  BASE_SERVINGS,
  DAILY,
  INGREDIENTS,
  RECIPES,
  RICE_BOWL,
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
    <div className="flex min-h-screen justify-center bg-bg break-keep">
      <div className="w-full max-w-app">
        <div className="space-y-4 px-4 pb-10 pt-6">
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
          <ShareMore />
          <OneTeamCardLink />
          <Sources date={pricesDate(rows)} />
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

function People({ people, setPeople }: { people: number; setPeople: (n: number) => void }) {
  return (
    <div className="flex gap-1.5" role="group" aria-label="몇 명이 먹나요">
      {SERVING_OPTIONS.map((n) => (
        <button
          key={n}
          onClick={() => setPeople(n)}
          aria-pressed={people === n}
          className={`flex-1 rounded-xl py-2.5 text-[15px] font-bold ${
            people === n ? 'bg-ink text-white' : 'bg-white text-sub shadow-card'
          }`}
        >
          {n}인 가족
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
    <>
      <section className="rounded-card bg-ink px-6 py-8 text-white">
        <p className="text-[13px] font-bold text-white/60">결영이네 집밥 레시피</p>
        <h1 className="mt-3 text-[28px] font-extrabold leading-[1.35]">
          오늘 저녁,
          <br />한 끼 얼마일까
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/80">
          쿠팡 가격으로 쓴 만큼만 계산했어요.
          <br />
          영양소는 식약처 자료로 봐요.
        </p>
      </section>

      <People people={people} setPeople={setPeople} />

      <ul className="space-y-2.5">
        {RECIPES.map((r) => {
          const cost = mealCost(r, people, prices)
          const n = mealNutrition(r)
          return (
            <li key={r.slug}>
              <button
                onClick={() => {
                  navigate(`/recipes/${r.slug}`)
                  window.scrollTo(0, 0)
                }}
                className="flex w-full items-center gap-3.5 rounded-card bg-card p-4 text-left shadow-card active:scale-[0.99]"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-bg text-[30px]">
                  {r.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-extrabold text-ink">{r.name}</span>
                  <span className="mt-0.5 block text-[13px] text-sub">{r.sub}</span>
                  <span className="mt-1.5 flex flex-wrap gap-x-2.5 text-[13px] text-cap">
                    <span className="font-bold text-brand">
                      {cost.perPerson !== null ? `1인 ${won(cost.perPerson)}` : '가격 받는 중'}
                    </span>
                    <span>{Math.round(n.kcal)}kcal</span>
                    <span>{r.minutes}분</span>
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-cap" />
              </button>
            </li>
          )
        })}
      </ul>
    </>
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
    <>
      <button
        onClick={() => navigate('/recipes')}
        className="-ml-1 flex items-center gap-0.5 text-[14px] font-semibold text-sub"
      >
        <ChevronLeft size={19} />
        집밥 레시피 전체
      </button>

      <header className="px-1">
        <p className="text-[40px]">{r.emoji}</p>
        <h1 className="mt-1 text-[26px] font-extrabold text-ink">{r.name}</h1>
        <p className="mt-1 flex items-center gap-1 text-[14px] text-sub">
          {r.sub} · <Clock size={14} /> {r.minutes}분
        </p>
      </header>

      <People people={people} setPeople={setPeople} />

      {/* ── 한 끼 얼마 */}
      <Box title="한 끼 얼마">
        {cost.total !== null ? (
          <>
            <p className="text-[15px] text-sub">{people}인 가족 한 끼</p>
            <p className="tnum text-[32px] font-extrabold text-ink">{won(cost.total)}</p>
            <p className="mt-1 text-[15px] font-bold text-brand">한 사람 {won(cost.perPerson!)}</p>
          </>
        ) : (
          <p className="text-[15px] leading-relaxed text-sub">
            재료 가격을 받아 오는 중이에요. 영양소와 재료 양은 먼저 볼 수 있어요.
          </p>
        )}
        <p className="mt-3 text-[13px] leading-relaxed text-cap">
          {r.withRice ? '밥 한 공기를 포함해서, ' : ''}재료는 한 봉지 값이 아니라 쓴 만큼만
          계산했어요.
        </p>
      </Box>

      {/* ── 영양소 */}
      <Box title="한 사람 한 끼 영양소">
        <p className="-mt-1 mb-3 text-[13px] text-cap">
          {r.withRice ? `${r.name} 1인분 + 밥 한 공기(${RICE_BOWL.cookedG}g)` : `${r.name} 1인분`} ·
          오른쪽 %는 하루 기준치 대비
        </p>
        <div className="space-y-3">
          <NutRow label="열량" value={`${Math.round(n.kcal)}kcal`} ratio={n.kcal / DAILY.kcal} />
          <NutRow label="탄수화물" value={`${Math.round(n.carb)}g`} ratio={n.carb / DAILY.carb} />
          <NutRow
            label="단백질"
            value={`${Math.round(n.protein)}g`}
            ratio={n.protein / DAILY.protein}
          />
          <NutRow label="지방" value={`${Math.round(n.fat)}g`} ratio={n.fat / DAILY.fat} />
          <NutRow
            label="나트륨"
            value={`${Math.round(n.sodium).toLocaleString('ko-KR')}mg`}
            ratio={n.sodium / DAILY.sodium}
            warn
          />
        </div>
      </Box>

      {/* ── 재료 */}
      <Box title={`재료 (${people}인분)`}>
        <ul className="divide-y divide-line">
          {ingredientsFor(r, people).map(([id, amount]) => {
            const unit = prices[id]
            const url = links[id]
            return (
              <li key={id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="text-[15px] font-semibold text-ink">
                    {INGREDIENTS[id]?.name}
                  </span>
                  <span className="ml-1.5 text-[14px] text-sub">{amountText(id, amount)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-[14px]">
                  {unit !== undefined && (
                    <span className="tnum text-sub">{won(Math.max(10, unit * amount))}</span>
                  )}
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="sponsored noopener noreferrer"
                      className="rounded-lg bg-bg px-2 py-1 text-[12px] font-bold text-brand"
                    >
                      쿠팡
                    </a>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </Box>

      {/* ── 만드는 순서 */}
      <Box title="만드는 순서">
        {/* 순서 속 물 양은 2인분 기준 — 인원을 바꾸면 알려 준다 */}
        {people !== BASE_SERVINGS && (
          <p className="-mt-1 mb-3 rounded-xl bg-bg px-3 py-2 text-[13px] text-sub">
            물 양은 2인분 기준이에요. {people}인분이면 {people / BASE_SERVINGS}배로 넣어요.
          </p>
        )}
        <ol className="space-y-3">
          {r.steps.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg text-[14px] font-extrabold text-brand">
                {i + 1}
              </span>
              <p className="pt-0.5 text-[15px] leading-relaxed text-ink">{s}</p>
            </li>
          ))}
        </ol>
      </Box>
    </>
  )
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card bg-card px-5 py-5 shadow-card">
      <h2 className="mb-3 text-[18px] font-extrabold text-ink">{title}</h2>
      {children}
    </section>
  )
}

function NutRow({
  label,
  value,
  ratio,
  warn = false,
}: {
  label: string
  value: string
  ratio: number
  warn?: boolean
}) {
  const pct = Math.round(ratio * 100)
  // 나트륨이 하루 기준치의 절반을 넘으면 눈에 띄게
  const high = warn && pct >= 50
  return (
    <div>
      <div className="flex items-baseline justify-between text-[15px]">
        <span className="text-sub">{label}</span>
        <span className="tnum font-bold text-ink">
          {value}
          <span className={`ml-1.5 text-[13px] ${high ? 'text-danger' : 'text-cap'}`}>{pct}%</span>
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg">
        <div
          className={`h-full rounded-full ${high ? 'bg-danger' : 'bg-brand'}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}

function Sources({ date }: { date: string | null }) {
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
          음식 100g(ml)당 값에 1인분 양을 곱했어요
        </li>
        <li>· 하루 기준치 — 식품 등의 표시기준(열량 2,000kcal, 나트륨 2,000mg 등)</li>
        <li>· 레시피 — 흔한 집밥을 집에서 하기 쉽게 정리했어요</li>
      </ul>
      <p className="mt-3">
        이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </p>
    </div>
  )
}
