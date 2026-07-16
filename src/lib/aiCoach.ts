import { supabase } from './supabase'
import { summarize } from './carryover'
import type { BudgetItem } from '../types'

// AI 진단에 보내는 요약 — 개인 식별 정보 없이 익명 집계만 (브리프 P3 4.3 데이터 최소화)
export interface CheckupSummary {
  ym: string
  income: number
  saving: number
  investment: number
  fixedTotal: number
  variableTotal: number
  surplus: number
  savingInvestRate: number
  fixedItems: { category: string; amount: number }[]
  variableItems: { category: string; amount: number }[]
}

/** 부부 합산·카테고리별 집계 (구성원 구분·계좌명 등은 보내지 않음) */
export function buildSummary(ym: string, items: BudgetItem[]): CheckupSummary {
  const s = summarize({ ym, items, closed: true })

  const byCategory = (group: BudgetItem['group']) => {
    const map = new Map<string, number>()
    for (const it of items) {
      if (it.group !== group) continue
      map.set(it.category, (map.get(it.category) ?? 0) + it.actual)
    }
    return [...map.entries()].map(([category, amount]) => ({ category, amount }))
  }

  return {
    ym,
    income: s.income,
    saving: s.saving,
    investment: s.investment,
    fixedTotal: s.fixed,
    variableTotal: s.variable,
    surplus: s.surplus,
    savingInvestRate: s.savingInvestRate,
    fixedItems: byCategory('fixed'),
    variableItems: byCategory('variable'),
  }
}

export async function requestDiagnosis(summary: CheckupSummary): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-coach', {
    body: { summary },
  })
  if (error) {
    throw new Error('진단 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')
  }
  if (data?.error) throw new Error(data.error)
  if (!data?.text) throw new Error('진단 결과를 받지 못했어요.')
  return data.text as string
}
