/**
 * 금 사는 곳 비교 (2026-10-24) — 금방 · KRX 금시장(증권사 앱) · 금 ETF.
 * 숫자와 규칙은 이 파일 한 곳에만 둔다. 시세는 기본값일 뿐이고 화면에서 오늘 값으로 바꾼다.
 */

/** 1돈 = 3.75g */
export const DON_G = 3.75

export const GOLD_RULES = {
  /** 기본 시세를 가져온 날 */
  updated: '2026-10-23',
  /** 한국금거래소 순금 1돈 고시가 (2026-10-23) — 살 때는 부가세 포함, 공임 별도 */
  shopBuyDon: 751_000,
  shopSellDon: 642_000,
  /** KRX 금시장 1g 종가 (2026-10-19, 178,960원) */
  krxG: 178_960,
  /** 나무증권 금현물 온라인 매매수수료 0.2% + 부가세 = 0.22% (살 때·팔 때 각각) */
  krxFee: 0.0022,
  /** 국내 상장 금 ETF 매매차익 — 배당소득세 15.4% */
  etfTax: 0.154,
  /** 실물로 꺼내거나 금방에서 살 때 붙는 부가세 */
  vat: 0.1,
}

/**
 * 증권사 금현물 수수료 (부가세 포함, 온라인) — 공식 안내에서 확인한 곳만 넣는다.
 * 나무증권: 매매 0.2%+VAT, 보관료 안내 없음. 미래에셋: 매매 0.15%+VAT, 보관료 하루 0.0002%+VAT.
 * 다른 증권사는 자료마다 숫자가 달라서 뺐다 (2026-10-24).
 */
export const BROKERS = [
  { name: '나무증권', trade: 0.0022, keepPerDay: 0 },
  { name: '미래에셋', trade: 0.00165, keepPerDay: 0.0000022 },
] as const

/** 금액만큼 사서 years년 두고 판 때 드는 수수료 합 (금값은 그대로라고 본다) */
export function brokerCost(b: (typeof BROKERS)[number], amount: number, years: number): number {
  return Math.round(amount * (b.trade * 2 + b.keepPerDay * 365 * years))
}

/** 금방에서 amount만큼 사서 바로 판다면 덜 받는 돈 — 살 때·팔 때 고시가 차이 */
export function shopCost(amount: number): number {
  return Math.round(amount * (1 - GOLD_RULES.shopSellDon / GOLD_RULES.shopBuyDon))
}

export interface GoldInput {
  /** 몇 돈 */
  don: number
  /** 금방 살 때 1돈 가격 */
  shopBuyDon: number
  /** 금방 팔 때 1돈 가격 */
  shopSellDon: number
  /** KRX 금 1g 가격 (증권사 앱 화면 값) */
  krxG: number
}

export const DEFAULT_GOLD: GoldInput = {
  don: 13,
  shopBuyDon: GOLD_RULES.shopBuyDon,
  shopSellDon: GOLD_RULES.shopSellDon,
  krxG: GOLD_RULES.krxG,
}

export interface GoldResult {
  grams: number
  /** 금방에서 새로 살 때 (공임 빼고) */
  shopBuy: number
  /** 금방에 팔 때 */
  shopSell: number
  /** 증권사 앱으로 살 때 (수수료 포함) */
  krxBuy: number
  /** 증권사 앱에서 팔 때 (수수료 뺀 금액) */
  krxSell: number
  /** 금방에서 살 때 − 앱으로 살 때 */
  buySaving: number
}

const won = (n: number) => Math.round(n)

export function computeGold(v: GoldInput): GoldResult {
  const grams = v.don * DON_G
  // 앱은 1g씩 사지만, 비교는 같은 무게로 한다 (반올림하면 1돈이 4g이 돼 앱 쪽이 손해로 보인다)
  const krxGross = grams * v.krxG
  const shopBuy = won(v.don * v.shopBuyDon)
  const krxBuy = won(krxGross * (1 + GOLD_RULES.krxFee))
  return {
    grams,
    shopBuy,
    shopSell: won(v.don * v.shopSellDon),
    krxBuy,
    krxSell: won(krxGross * (1 - GOLD_RULES.krxFee)),
    buySaving: shopBuy - krxBuy,
  }
}
