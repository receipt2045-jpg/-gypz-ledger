import { supabase } from './supabase'
import type { Pack, UnitPrices } from './recipes'

/**
 * 재료값 — recipe_prices 표 (2026-11-01).
 * 채우는 쪽: Edge Function coupang-prices가 쿠팡파트너스 검색으로 한 봉지 값을 받아
 * 1g(ml·개)당 값(unit_price)으로 바꿔 둔다. 앱은 읽기만 한다.
 */
export interface IngredientPrice {
  ingredient: string
  productName: string | null
  price: number | null
  unitPrice: number | null
  productUrl: string | null
  updatedAt: string | null
}

export async function fetchRecipePrices(): Promise<IngredientPrice[]> {
  const { data, error } = await supabase
    .from('recipe_prices')
    .select('ingredient,product_name,price,unit_price,product_url,updated_at')
  if (error) throw error
  return (data ?? []).map((r) => ({
    ingredient: r.ingredient as string,
    productName: r.product_name as string | null,
    price: r.price as number | null,
    unitPrice: r.unit_price === null ? null : Number(r.unit_price),
    productUrl: r.product_url as string | null,
    updatedAt: r.updated_at as string | null,
  }))
}

/** 값이 있는 재료만 { id: 1단위 값 } */
export function unitPrices(rows: IngredientPrice[]): UnitPrices {
  const out: UnitPrices = {}
  for (const r of rows) if (r.unitPrice !== null && r.unitPrice > 0) out[r.ingredient] = r.unitPrice
  return out
}

/** 장보기용 한 봉지 — 봉지 크기는 값 ÷ 1단위 값으로 되찾는다 (묶음 수까지 들어 있다) */
export function packsOf(rows: IngredientPrice[]): Record<string, Pack> {
  const out: Record<string, Pack> = {}
  for (const r of rows) {
    if (!r.price || !r.unitPrice) continue
    out[r.ingredient] = { price: r.price, units: r.price / r.unitPrice, url: r.productUrl }
  }
  return out
}

/** 가장 늦게 바뀐 값의 날짜 — "11월 1일 쿠팡 가격" */
export function pricesDate(rows: IngredientPrice[]): string | null {
  const ds = rows.map((r) => r.updatedAt).filter((d): d is string => !!d)
  if (!ds.length) return null
  const d = new Date(ds.sort()[0])
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}
