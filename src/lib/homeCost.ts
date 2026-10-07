/**
 * 집 살 때 드는 돈 (2026-10-07) — 매매 잔금날 집값 말고 더 나가는 돈.
 * 세율·요율은 이 파일 한 곳에 둔다. 법령이 바뀌면 여기만 고치고 HOME_COST_BASE_DATE를 올린다.
 *
 * 근거
 * - 취득세: 지방세법 제11조 1항 8호 — 6억 이하 1%, 6억~9억 (가액×2/3억 − 3)% (소수점 넷째 자리까지), 9억 초과 3%.
 *   다주택 중과(제13조의2): 조정대상지역 2주택 8%·3주택 이상 12%, 그 밖 3주택 8%·4주택 이상 12%. 일시적 2주택은 일반세율.
 * - 지방교육세: 일반세율이면 취득세액의 10%, 중과면 가액의 0.4%.
 * - 농어촌특별세: 전용 85㎡ 초과만 — 일반 0.2%, 중과 8%면 0.6%·12%면 1.0%.
 * - 생애최초 감면(지방세특례제한법 제36조의3): 12억 이하, 취득세 최대 200만원 (2028년 말까지).
 *   2026 지방세제 개편안의 '40세 미만 300만원'은 시행 전이라 넣지 않았다.
 * - 중개보수 상한(공인중개사법 시행규칙, 2021.10): 5천만 미만 0.6%(한도 25만) · 2억 미만 0.5%(80만) · 9억 미만 0.4%
 *   · 12억 미만 0.5% · 15억 미만 0.6% · 15억 이상 0.7%. 부가세 10% 별도(일반과세자).
 * - 인지세(인지세법): 주택 매매계약서 1억 이하 비과세 · 10억 이하 15만 · 초과 35만 — 매도·매수 반씩.
 *   대출 약정서 5천만 이하 비과세 · 1억 이하 7만 · 10억 이하 15만 · 초과 35만 — 은행과 반씩.
 * - 국민주택채권(주택도시기금법 시행령 별표): 시가표준액(공시가격) 구간별 매입률, 서울·광역시가 더 높다.
 *   근저당 설정은 채권최고액의 1%. 바로 되팔면 '할인율'만큼만 실제로 낸다(매일 바뀜).
 * - 법무사 보수: 대한법무사협회 보수기준(2024.9.12) 소유권이전 기본보수 + 부가세, 대행·실비는 어림값.
 * - 등기신청수수료: 전자표준양식 15,000원.
 */
export const HOME_COST_BASE_DATE = '2026년 10월'

export type BondRegion = 'metro' | 'other'

export interface HomeCostInput {
  price: number
  bondRegion: BondRegion
  /** 조정대상지역 */
  adjusted: boolean
  /** 전용 85㎡ 초과 */
  over85: boolean
  /** 이 집을 사고 난 뒤 주택 수 (4 = 4주택 이상) */
  homesAfter: number
  firstHome: boolean
  /** 일시적 2주택 — 기존 집을 기한 안에 처분 */
  temporaryTwo: boolean
  loan: number
  /** 공시가격 — 0이면 매매가로 추정 */
  publicPrice: number
  /** 국민주택채권 즉시매도 할인율(%) */
  bondDiscount: number
  /** 중개보수 협의 요율(%) — 0이면 상한 */
  brokerRate: number
  /** 법무사 견적(원) — 0이면 기준표로 */
  lawyerFee: number
}

export interface CostItem {
  label: string
  amount: number
  note?: string
}

export interface CostGroup {
  title: string
  total: number
  items: CostItem[]
}

/** 공시가격을 모를 때 — 매매가의 약 70%로 본다 */
export const PUBLIC_PRICE_RATIO = 0.7
/** 근저당 채권최고액 — 대출금의 120%가 보통 */
export const MORTGAGE_MAX_RATIO = 1.2
/** 국민주택채권 할인율 기본값(%) — 매일 바뀐다. 잔금일 값은 주택도시기금 누리집에서 확인 */
export function defaultBondDiscount(): number {
  return 15
}

const won = (n: number) => Math.max(0, Math.round(n))

/** 취득세율(%) — 일반세율 */
export function generalRate(price: number): number {
  if (price <= 600_000_000) return 1
  if (price > 900_000_000) return 3
  const r = (price * 2) / 300_000_000 - 3
  return Math.round(r * 10_000) / 10_000 // 소수점 다섯째 자리에서 반올림
}

/** 중과 세율(%) — 아니면 null */
export function heavyRate(
  input: Pick<HomeCostInput, 'homesAfter' | 'adjusted' | 'temporaryTwo'>,
): number | null {
  const { homesAfter: n, adjusted, temporaryTwo } = input
  if (adjusted) {
    if (n === 2) return temporaryTwo ? null : 8
    if (n >= 3) return 12
    return null
  }
  if (n === 3) return 8
  if (n >= 4) return 12
  return null
}

export function brokerFee(price: number, ratePct: number): { amount: number; note: string } {
  let rate: number
  let cap = Infinity
  if (price < 50_000_000) {
    rate = 0.6
    cap = 250_000
  } else if (price < 200_000_000) {
    rate = 0.5
    cap = 800_000
  } else if (price < 900_000_000) rate = 0.4
  else if (price < 1_200_000_000) rate = 0.5
  else if (price < 1_500_000_000) rate = 0.6
  else rate = 0.7
  const used = ratePct > 0 ? Math.min(ratePct, rate) : rate
  const fee = Math.min((price * used) / 100, cap)
  return {
    amount: won(fee * 1.1),
    note: `${ratePct > 0 ? '협의' : '상한'} ${used}% + 부가세 10%`,
  }
}

/** 법무사 기본보수 (협회 기준표, 소유권이전) */
export function lawyerBase(price: number): number {
  const steps: [number, number, number][] = [
    // [구간 시작, 시작 금액, 초과분 요율(만분의)]
    [10_000_000, 100_000, 11],
    [50_000_000, 144_000, 10],
    [100_000_000, 194_000, 9],
    [300_000_000, 374_000, 8],
    [500_000_000, 534_000, 7],
    [1_000_000_000, 884_000, 5],
  ]
  if (price <= 10_000_000) return 100_000
  let base = 100_000
  for (const [from, start, per] of steps) {
    if (price > from) base = start + ((price - from) * per) / 10_000
  }
  return won(base)
}

/** 대행료·실비 어림값 (원인증서·세금신고·채권매입 대행 등) */
const LAWYER_EXTRA = 150_000

export function bondRate(publicPrice: number, region: BondRegion): number {
  const table: [number, number, number][] = [
    // [이상, 서울·광역시, 그 밖] (1천분의)
    [600_000_000, 31, 26],
    [260_000_000, 26, 21],
    [160_000_000, 23, 18],
    [100_000_000, 21, 16],
    [50_000_000, 19, 14],
    [20_000_000, 13, 13],
  ]
  for (const [min, metro, other] of table) {
    if (publicPrice >= min) return (region === 'metro' ? metro : other) / 1000
  }
  return 0
}

function contractStamp(price: number): number {
  if (price <= 100_000_000) return 0
  return price <= 1_000_000_000 ? 150_000 : 350_000
}

function loanStamp(loan: number): number {
  if (loan <= 50_000_000) return 0
  if (loan <= 100_000_000) return 70_000
  return loan <= 1_000_000_000 ? 150_000 : 350_000
}

export function computeHomeCost(input: HomeCostInput) {
  const { price } = input
  const heavy = heavyRate(input)
  const rate = heavy ?? generalRate(price)

  // ── 세금 ──
  let acq = (price * rate) / 100
  let firstHomeCut = 0
  if (input.firstHome && input.homesAfter === 1 && heavy === null && price <= 1_200_000_000) {
    firstHomeCut = Math.min(acq, 2_000_000)
    acq -= firstHomeCut
  }
  const eduTax = heavy !== null ? price * 0.004 : ((price * rate) / 100) * 0.1
  const ruralTax = input.over85 ? price * (heavy === 12 ? 0.01 : heavy === 8 ? 0.006 : 0.002) : 0
  const tax: CostItem[] = [
    {
      label: '취득세',
      amount: won(acq),
      note: `${heavy !== null ? '중과 ' : ''}${rate}%${firstHomeCut ? ` · 생애최초 ${Math.round(firstHomeCut / 10_000)}만원 감면` : ''}`,
    },
    {
      label: '지방교육세',
      amount: won(eduTax),
      note: heavy !== null ? '집값의 0.4%' : '취득세의 10%',
    },
    {
      label: '농어촌특별세',
      amount: won(ruralTax),
      note: input.over85 ? '전용 85㎡ 초과' : '85㎡ 이하는 안 내요',
    },
  ]

  // ── 거래·등기 ──
  const broker = brokerFee(price, input.brokerRate)
  const lawyer = input.lawyerFee > 0 ? input.lawyerFee : won(lawyerBase(price) * 1.1 + LAWYER_EXTRA)
  const publicPrice = input.publicPrice > 0 ? input.publicPrice : price * PUBLIC_PRICE_RATIO
  const bondBuy = publicPrice * bondRate(publicPrice, input.bondRegion)
  const bondCost = (bondBuy * input.bondDiscount) / 100
  const deal: CostItem[] = [
    { label: '중개보수 (복비)', amount: broker.amount, note: broker.note },
    {
      label: '법무사 보수',
      amount: lawyer,
      note: input.lawyerFee > 0 ? '받은 견적' : '협회 기준 + 부가세 + 대행·실비 어림',
    },
    { label: '등기신청수수료', amount: 15_000, note: '전자표준양식' },
    { label: '인지세 (매매계약서)', amount: won(contractStamp(price) / 2), note: '매도인과 반씩' },
    {
      label: '국민주택채권',
      amount: won(bondCost),
      note: `${Math.round(bondBuy / 10_000).toLocaleString('ko-KR')}만원어치 사서 바로 팔면 할인율 ${input.bondDiscount}%만큼`,
    },
  ]

  // ── 대출 ──
  const loanItems: CostItem[] = []
  if (input.loan > 0) {
    const max = input.loan * MORTGAGE_MAX_RATIO
    const mBond = max >= 20_000_000 ? Math.min(max * 0.01, 1_000_000_000) : 0
    loanItems.push(
      {
        label: '인지세 (대출 약정서)',
        amount: won(loanStamp(input.loan) / 2),
        note: '은행과 반씩',
      },
      {
        label: '국민주택채권 (근저당)',
        amount: won((mBond * input.bondDiscount) / 100),
        note: `채권최고액 ${Math.round(max / 10_000).toLocaleString('ko-KR')}만원의 1%`,
      },
    )
  }

  const groups: CostGroup[] = [
    { title: '세금', items: tax },
    { title: '거래 · 등기', items: deal },
    ...(loanItems.length ? [{ title: '대출', items: loanItems }] : []),
  ].map((g) => ({ ...g, total: g.items.reduce((a, it) => a + it.amount, 0) }))

  return {
    total: groups.reduce((a, g) => a + g.total, 0),
    groups,
    rate,
    heavy: heavy !== null,
    /** 근저당 설정 비용 — 2011년부터 은행이 낸다 */
    bankPays:
      input.loan > 0
        ? ['근저당 설정 등록면허세·지방교육세', '근저당 등기 법무사비', '감정평가비']
        : [],
  }
}
