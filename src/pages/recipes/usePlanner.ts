import { useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_SETTINGS,
  makeWeekPlan,
  mondayKey,
  packsWithEstimate,
  planStillValid,
  settingsKey,
  swapDay,
  type MealSettings,
  type WeekPlan,
} from '../../lib/mealPlan'
import { fetchRecipePrices, packsOf, type IngredientPrice } from '../../lib/recipePrices'
import {
  fetchHouseSettings,
  loadLocalSettings,
  pushHouseSettings,
  saveLocalSettings,
  useMealLedger,
} from '../../lib/mealLedger'

/** 이번 주 식단 — 이 폰에 기억 (장 보러 가서 다시 열어도 그대로) */
const PLAN_KEY = 'moabuli.recipes.week'

interface SavedPlan {
  week: string
  settings: string
  /** 새로 짠 횟수 — 같은 주에 「새로 짜기」를 누르면 1, 2, … */
  gen: number
  plan: WeekPlan
}

function loadPlan(): SavedPlan | null {
  try {
    const v = JSON.parse(localStorage.getItem(PLAN_KEY) ?? 'null')
    return v && Array.isArray(v.plan) && v.plan.length === 7 ? (v as SavedPlan) : null
  } catch {
    return null
  }
}
function savePlan(p: SavedPlan) {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(p))
  } catch {
    /* 시크릿 모드 */
  }
}

export function usePlanner() {
  const ledger = useMealLedger()
  const [settings, setSettingsState] = useState<MealSettings>(() => loadLocalSettings() ?? DEFAULT_SETTINGS)
  /** 기준을 한 번이라도 정했나 — 처음 온 사람은 기준 화면 안내를 크게 */
  const [hasSettings, setHasSettings] = useState(() => loadLocalSettings() !== null)
  /** 집(남편 폰)과 같이 쓰나 — households.meal_plan 칸이 있을 때 */
  const [shared, setShared] = useState(false)

  // 로그인한 집이면 집에 저장된 기준을 먼저
  const hid = ledger.link?.householdId
  useEffect(() => {
    if (!hid) return
    let live = true
    fetchHouseSettings(hid)
      .then((s) => {
        if (!live || !s) return
        setSettingsState(s)
        saveLocalSettings(s)
        setHasSettings(true)
        setShared(true)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [hid])

  const setSettings = (s: MealSettings) => {
    setSettingsState(s)
    saveLocalSettings(s)
    setHasSettings(true)
    if (hid) void pushHouseSettings(hid, s).then(setShared)
  }

  // 재료값 — 표(쿠팡)에 있으면 그 값, 없으면 예상값
  const [rows, setRows] = useState<IngredientPrice[]>([])
  useEffect(() => {
    fetchRecipePrices()
      .then(setRows)
      .catch(() => setRows([]))
  }, [])
  const live = useMemo(() => packsOf(rows), [rows])
  const { packs, estimated } = useMemo(() => packsWithEstimate(live), [live])

  const week = mondayKey()
  const month = new Date().getMonth() + 1
  const sKey = settingsKey(settings)
  const [saved, setSaved] = useState<SavedPlan | null>(loadPlan)

  // 주가 바뀌었거나 기준이 바뀌었으면 새로 짠다
  const current = useMemo<SavedPlan>(() => {
    if (saved && saved.week === week && saved.settings === sKey && planStillValid(saved.plan, settings))
      return saved
    const gen = saved && saved.week === week ? saved.gen : 0
    return { week, settings: sKey, gen, plan: makeWeekPlan(settings, month, `${week}#${gen}`, live) }
    // live 값이 늦게 와도 이미 짠 식단은 그대로 둔다 (보는 중에 반찬이 바뀌면 헷갈린다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved, week, sKey])
  useEffect(() => {
    if (current !== saved) {
      savePlan(current)
      setSaved(current)
    }
  }, [current, saved])

  const regenerate = () => {
    const gen = current.gen + 1
    const next = { ...current, gen, plan: makeWeekPlan(settings, month, `${week}#${gen}`, live) }
    savePlan(next)
    setSaved(next)
  }
  const swap = (day: number) => {
    const gen = current.gen + 1
    const next = { ...current, gen, plan: swapDay(current.plan, day, settings, month, `${week}#${gen}`, live) }
    savePlan(next)
    setSaved(next)
  }

  return {
    ledger,
    settings,
    setSettings,
    hasSettings,
    shared,
    packs,
    estimated,
    rows,
    week,
    month,
    plan: current.plan,
    regenerate,
    swap,
  }
}

export type Planner = ReturnType<typeof usePlanner>
