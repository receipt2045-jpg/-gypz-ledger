import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { fetchConfessions, fetchHouseholdData, getMyMembership, insertConfession } from './db'
import { useLedgerStore } from './store'
import { currentYm } from './format'
import { ymOfIso } from './confessLedger'
import { genId } from './carryover'
import { cleanSettings, type MealSettings } from './mealPlan'
import type { Confession, MonthlyLedger } from '../types'

/**
 * 집밥 플래너 ↔ 모아불리 가계부 (2026-11-26, 결영 확정: 보여주기 + 적기 버튼).
 * - 읽기: 이번 달 예산 표의 '식비' 예산, 소비 기록의 '식비' 합계 → 남은 돈
 * - 쓰기: 「장 본 돈 가계부에 적기」를 누를 때만 소비 기록(식비) 한 줄. 예산 표는 안 건드린다
 * - 우리집 식비 기준: households.meal_plan 칸(supabase/household-meal-plan.sql)이 있으면 집에 저장해
 *   남편 폰에서도 같게. 칸이 없거나 로그인 안 했으면 이 폰에만.
 */

export const FOOD = '식비'

export interface FoodBudget {
  ym: string
  /** 예산 표의 식비 예산 합 (두 사람 칸 합) — 안 정했으면 0 */
  planned: number
  /** 이번 달 소비 기록 식비 합 */
  spent: number
}

export function foodBudgetOf(ledgers: MonthlyLedger[], confessions: Confession[], ym: string): FoodBudget {
  const ledger = ledgers.find((l) => l.ym === ym)
  const planned = (ledger?.items ?? [])
    .filter((i) => i.category === FOOD)
    .reduce((s, i) => s + (i.planned || 0), 0)
  const spent = confessions
    .filter((c) => c.category === FOOD && c.kind === 'variable' && c.amount > 0 && ymOfIso(c.createdAt) === ym)
    .reduce((s, c) => s + c.amount, 0)
  return { ym, planned, spent }
}

interface Linked {
  householdId: string
  memberNo: 1 | 2
}

/** 로그인한 가계부 — 앱 안에서 넘어왔으면 불러온 것, 링크로 바로 열었으면 로그인돼 있을 때만 */
export function useMealLedger() {
  const store = useLedgerStore((s) =>
    s.status === 'ready' && s.householdId && !s.sample
      ? { householdId: s.householdId, memberNo: s.memberNo, ledgers: s.ledgers, confessions: s.confessions }
      : null,
  )
  const [own, setOwn] = useState<{ link: Linked; ledgers: MonthlyLedger[]; confessions: Confession[] } | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (store) {
      setChecked(true)
      return
    }
    let live = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) return
      const m = await getMyMembership()
      if (!m) return
      const [hh, cs] = await Promise.all([fetchHouseholdData(m.householdId), fetchConfessions(m.householdId)])
      if (live)
        setOwn({
          link: { householdId: m.householdId, memberNo: m.memberNo as 1 | 2 },
          ledgers: hh.ledgers,
          confessions: cs,
        })
    })()
      .catch(() => {
        /* 못 읽으면 가계부 칸을 안 띄운다 — 플래너는 그대로 쓴다 */
      })
      .finally(() => live && setChecked(true))
    return () => {
      live = false
    }
    // store가 생기면(앱 안에서 넘어옴) 그걸 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!store])

  const link: Linked | null = store
    ? store.memberNo
      ? { householdId: store.householdId, memberNo: store.memberNo }
      : null
    : (own?.link ?? null)
  const ym = currentYm()
  const budget = store
    ? foodBudgetOf(store.ledgers, store.confessions, ym)
    : own
      ? foodBudgetOf(own.ledgers, own.confessions, ym)
      : null

  /** 장 본 돈 적기 — 소비 기록 식비 한 줄 */
  const record = useCallback(
    async (amount: number, note: string) => {
      if (store) {
        useLedgerStore.getState().addConfession({ category: FOOD, kind: 'variable', amount, note })
        return
      }
      if (!own) throw new Error('로그인이 필요해요')
      const c: Confession = {
        id: genId(),
        memberNo: own.link.memberNo,
        category: FOOD,
        kind: 'variable',
        amount,
        note,
        createdAt: new Date().toISOString(),
      }
      await insertConfession(own.link.householdId, c)
      setOwn({ ...own, confessions: [c, ...own.confessions] })
    },
    [store, own],
  )

  return { checked, linked: !!link, link, budget, record }
}

// ── 우리집 식비 기준 저장 ──

const KEY = 'moabuli.recipes.settings'

export function loadLocalSettings(): MealSettings | null {
  try {
    const v = localStorage.getItem(KEY)
    return v ? cleanSettings(JSON.parse(v)) : null
  } catch {
    return null
  }
}

export function saveLocalSettings(s: MealSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* 시크릿 모드 */
  }
}

/** 집에 저장된 기준 — 칸이 없는 DB(SQL 안 돌림)면 null */
export async function fetchHouseSettings(householdId: string): Promise<MealSettings | null> {
  const { data, error } = await supabase.from('households').select('meal_plan').eq('id', householdId).single()
  if (error || !data?.meal_plan) return null
  return cleanSettings(data.meal_plan)
}

export async function pushHouseSettings(householdId: string, s: MealSettings): Promise<boolean> {
  const { error } = await supabase.from('households').update({ meal_plan: s }).eq('id', householdId)
  return !error
}
