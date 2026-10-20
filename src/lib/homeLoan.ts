/**
 * 내집마련 대출 찾기 (2026-10-20) — 원팀 프로젝트 2강 '내 집 마련을 위한 대출의 이해' 그대로.
 * 우리 조건을 넣으면 디딤돌·신생아 특례·보금자리론·은행(보험사) 주담대를 받을 수 있는지, 한도와 첫 달 갚는 돈을 낸다.
 * 숫자는 모두 이 파일 한 곳에. 정책이 바뀌면 여기만 고치고 HOME_LOAN_BASE_DATE를 올린다.
 *
 * 한도 = 셋 중 가장 작은 값 (강의 43~45쪽): 상품·지역 한도 / LTV − 방공제 / 소득(정책=DTI, 은행=DSR+스트레스)
 * 방공제는 LTV 쪽에서만 뺀다. 금액은 원 단위.
 */
export const HOME_LOAN_BASE_DATE = '2026년 10월'

/** 체증식 최대 기간 — 보금자리론이 50년까지 되어도 체증식은 40년까지 */
export const GRADUATED_MAX_YEARS = 40

const MAN = 10_000
const EOK = 100_000_000

export type Region = 'seoul' | 'metro' | 'city' | 'other'
export type AgeBand = 'u25' | '25' | '30' | '35' | '40' | '50'
export type Area = '85' | '100' | 'big'
export type RateType = 'cycle' | 'mix' | 'var'
export type Lender = 'bank' | 'ins'
export type Method = 'grad' | 'ann' | 'prin'

export interface LoanFinderInput {
  income1: number // 연소득(원)
  income2: number
  own: number // 집 사는 데 쓸 우리 돈
  monthly: number // 한 달에 부담 없는 상환액
  age: AgeBand // 대출 받는 사람 나이
  home: 'none' | 'one'
  first: boolean // 생애 처음 사는 집
  newly: boolean // 결혼 7년 이내
  baby: boolean // 2년 안에 출산
  assetOk: boolean // 순자산 5.11억 이하
  worker: boolean // 근로소득자
  kids: 0 | 1 | 2 // 2 = 2명 이상
  deal: number // 매매가
  kb: number // KB시세
  publicPrice: number // 공시가격 — 0이면 KB시세 × 70%
  region: Region
  eup: boolean // 지방 읍·면
  regulated: boolean // 규제지역
  overheated: boolean // 투기과열지구
  area: Area
  rateType: RateType
  lender: Lender
  mortgageInsurance: boolean // MCI·MCG — 방공제 없이
}

/** 소액임차인 최우선변제금 = 방공제 (강의 40쪽) */
export const REGION: Record<Region, { label: string; bang: number; capital: boolean }> = {
  seoul: { label: '서울', bang: 5_500 * MAN, capital: true },
  metro: { label: '경기·인천', bang: 4_800 * MAN, capital: true },
  city: { label: '광역시', bang: 2_800 * MAN, capital: false },
  other: { label: '그 밖', bang: 2_500 * MAN, capital: false },
}

/** 금리 유형 — 스트레스 금리 반영 비율 (강의 33쪽), 금리는 강의 76쪽 최저 금리 어림 (혼합형은 사이값) */
export const RATE_TYPE: Record<RateType, { label: string; stressRatio: number; rate: number }> = {
  cycle: { label: '주기형', stressRatio: 0.3, rate: 5.2 },
  mix: { label: '혼합형', stressRatio: 0.6, rate: 5.0 },
  var: { label: '변동형', stressRatio: 1.0, rate: 4.7 },
}

/** 장래소득 반영률 (강의 36쪽) — 무주택 근로소득자 · 주담대 · 10년 이상 비거치 */
export const FUTURE_INCOME: Partial<Record<AgeBand, number>> = {
  u25: 0.557,
  '25': 0.319,
  '30': 0.178,
}

export const METHOD_LABEL: Record<Method, string> = {
  grad: '체증식',
  ann: '원리금균등',
  prin: '원금균등',
}

/** 매달 pmt씩 갚으면 빌릴 수 있는 돈 (원리금균등) */
export function principalFor(monthlyPay: number, ratePct: number, years: number): number {
  const r = ratePct / 1200
  const n = years * 12
  if (r === 0) return monthlyPay * n
  return (monthlyPay * (1 - Math.pow(1 + r, -n))) / r
}

/** 원리금균등 월 상환액 */
export function annuityPayment(amount: number, ratePct: number, years: number): number {
  const r = ratePct / 1200
  const n = years * 12
  if (amount <= 0) return 0
  if (r === 0) return amount / n
  return (amount * r) / (1 - Math.pow(1 + r, -n))
}

export interface PlanRow {
  first: number
  last: number
  interest: number
}

/** 상환 방식 셋 — 첫 달 · 마지막 달 · 총 이자 (체증식은 앱 대출 계산기와 같은 어림: 첫 달 = 원리금균등의 60%) */
export function repaymentPlans(
  amount: number,
  ratePct: number,
  years: number,
): Record<Method, PlanRow> {
  const r = ratePct / 1200
  const n = years * 12
  const ann = annuityPayment(amount, ratePct, years)
  let a = 0
  let ia = 0
  for (let k = 1; k <= n; k++) {
    const v = Math.pow(1 + r, -k)
    a += v
    ia += (k - 1) * v
  }
  const first = Math.max(ann * 0.6, amount * r + 1)
  const step = n > 1 ? (amount - first * a) / ia : 0
  return {
    grad: {
      first,
      last: first + step * (n - 1),
      interest: n * first + (step * n * (n - 1)) / 2 - amount,
    },
    ann: { first: ann, last: ann, interest: ann * n - amount },
    prin: {
      first: amount / n + amount * r,
      last: (amount / n) * (1 + r),
      interest: (amount * r * (n + 1)) / 2,
    },
  }
}

export type LoanKey = 'didim' | 'baby' | 'bogeum' | 'general'
export type AskKey = 'fund' | 'hf' | 'consultant'

export interface LoanResult {
  key: LoanKey
  name: string
  sub: string
  note?: string
  /** 안 되는 이유 — 비어 있으면 받을 수 있다 */
  blockers: string[]
  rate: number
  years: number
  method: Method
  /** 한도를 정한 세 값 */
  parts: { label: string; amount: number }[]
  limit: number
  /** 필요한 대출만큼(한도 안에서) 빌렸을 때 */
  use: number
  plans: Record<Method, PlanRow> | null
  firstPayment: number
  enough: boolean
  /** 연말정산 장기주택저당차입금 이자 소득공제 한도(원/년) — 0이면 해당 없음 */
  deduction: number
  ask: AskKey
}

export interface LoanFinderResult {
  need: number
  affordable: number
  incomeTimesFive: number
  loans: LoanResult[] // 받을 수 있는 것, 유리한 순
  blocked: LoanResult[]
  best: LoanResult | null
  canBuy: number
}

/** 장기주택저당차입금 이자 소득공제 한도 (강의 22~24쪽) */
function deductionLimit(i: LoanFinderInput, fixed: boolean, years: number): number {
  const pub = i.publicPrice > 0 ? i.publicPrice : i.kb * 0.7
  if (!i.worker || pub > 6 * EOK) return 0
  if (years >= 15) return fixed ? 2_000 * MAN : 1_800 * MAN // 정책대출·주기형은 고정+비거치로 본다
  if (years >= 10) return 600 * MAN
  return 0
}

export function findLoans(i: LoanFinderInput): LoanFinderResult {
  const income = i.income1 + i.income2
  const reg = REGION[i.region]
  const capital = reg.capital
  const noHome = i.home === 'none'
  const low = Math.min(i.deal, i.kb)
  const need = Math.max(0, i.deal - i.own)
  const areaOk = i.area === '85' || (i.area === '100' && i.eup && !capital)
  const policyLtv = i.first ? (capital || i.regulated ? 70 : 80) : 70
  const raw: Omit<LoanResult, 'parts' | 'limit' | 'use' | 'plans' | 'firstPayment' | 'enough'>[] =
    []
  const sources: {
    prod: number
    ltv: number
    base: number
    bang: number
    inc: number
    incLabel: string
  }[] = []

  // ── 디딤돌 (강의 53~56쪽)
  {
    const b: string[] = []
    const priceMax = (i.newly || i.kids >= 2 ? 6 : 5) * EOK
    const incomeMax = (i.newly ? 8_500 : i.first || i.kids >= 2 ? 7_000 : 6_000) * MAN
    if (!noHome) b.push('세대원 모두 집이 없어야 해요')
    if (!i.assetOk) b.push('순자산 5.11억 이하')
    if (!areaOk) b.push('전용 85㎡ 이하 (지방 읍·면 100㎡)')
    if (low > priceMax) b.push(`집값 ${priceMax / EOK}억 이하`)
    if (income > incomeMax) b.push(`부부 소득 ${(incomeMax / MAN).toLocaleString('ko-KR')}만 이하`)
    // 금리 2.85~4.15% — 소득이 높을수록 높게 어림
    const rate = Math.min(4.15, 2.85 + (income / incomeMax) * 1.3)
    // 방공제: 수도권은 차감(3억 이하·연소득 4천 이하 예외), 지방은 생애최초면 면제 (강의 42·68쪽)
    const bang = capital
      ? low <= 3 * EOK && income <= 4_000 * MAN
        ? 0
        : reg.bang
      : i.first
        ? 0
        : reg.bang
    raw.push({
      key: 'didim',
      name: '디딤돌',
      sub: '정책대출 · 낮은 금리 · DSR 안 봄',
      blockers: b,
      rate,
      years: 30,
      method: 'grad',
      deduction: deductionLimit(i, true, 30),
      ask: 'fund',
    })
    sources.push({
      prod: (i.newly || i.kids >= 2 ? 32_000 : i.first ? 24_000 : 20_000) * MAN,
      ltv: policyLtv,
      base: low,
      bang,
      inc: principalFor((income * 0.6) / 12, rate, 30),
      incLabel: 'DTI 60%',
    })
  }

  // ── 신생아 특례 (강의 57~59쪽)
  {
    const b: string[] = []
    const both = i.income1 > 0 && i.income2 > 0
    const incomeMax = (both ? 2 : 1.3) * EOK
    if (!i.baby) b.push('2년 안에 출산한 아이가 있어야 해요')
    if (!noHome) b.push('집이 없어야 해요 (1주택은 갈아타기만)')
    if (income > incomeMax) b.push(`부부 소득 ${both ? '2억' : '1.3억'} 이하`)
    if (!i.assetOk) b.push('순자산 5.11억 이하')
    if (!areaOk) b.push('전용 85㎡ 이하')
    if (low > 9 * EOK) b.push('집값 9억 이하')
    const rate = Math.min(4.5, 1.8 + (income / (1.3 * EOK)) * 2.2)
    // 방공제: 수도권 3억 초과~6억 이하, 지방 생애최초면 면제 (강의 42쪽)
    const bang = capital ? (low > 3 * EOK && low <= 6 * EOK ? 0 : reg.bang) : i.first ? 0 : reg.bang
    raw.push({
      key: 'baby',
      name: '신생아 특례',
      sub: '정책대출 · 특례 금리는 아이 1명당 5년',
      blockers: b,
      rate,
      years: 30,
      method: 'grad',
      deduction: deductionLimit(i, true, 30),
      ask: 'fund',
    })
    sources.push({
      prod: 4 * EOK,
      ltv: policyLtv,
      base: low,
      bang,
      inc: principalFor((income * 0.6) / 12, rate, 30),
      incLabel: 'DTI 60%',
    })
  }

  // ── 보금자리론 (강의 60~67쪽)
  {
    const b: string[] = []
    let incomeOk: boolean
    if (i.kids >= 2) incomeOk = income <= 1 * EOK
    else if (i.kids === 1) incomeOk = income <= 9_000 * MAN
    // 결혼 페널티 해소('26.10~): 신혼은 합산 8,500만 이하 또는 한 명이 7,000만 이하
    else if (i.newly)
      incomeOk = income <= 8_500 * MAN || i.income1 <= 7_000 * MAN || i.income2 <= 7_000 * MAN
    else incomeOk = income <= 7_000 * MAN
    if (i.deal > 6 * EOK || i.kb > 6 * EOK) b.push('매매가·KB시세 둘 다 6억 이하')
    if (!incomeOk)
      b.push(
        i.newly
          ? '합산 8,500만 이하 또는 한 명이 7,000만 이하'
          : `부부 소득 ${i.kids >= 2 ? '1억' : i.kids === 1 ? '9,000만' : '7,000만'} 이하`,
      )
    const seomin = noHome && low <= 6 * EOK && income <= 7_000 * MAN // 서민실수요자
    let ltv = 70
    let dti = 60
    if (i.first) ltv = capital || i.regulated ? 70 : 80
    else if (i.regulated && !seomin) {
      ltv = 60
      dti = 50
    }
    // 나이·신혼에 따라 받을 수 있는 최대 기간
    const young = i.age === 'u25' || i.age === '25' || i.age === '30'
    const maxYears = young
      ? 50
      : i.age === '35'
        ? i.newly
          ? 50
          : 40
        : i.age === '40'
          ? i.newly
            ? 40
            : 30
          : 30
    const rate = 4.8 // 4.9~5.3%에서 아낌e보금자리론 −0.1%
    // 체증식은 최대 40년 (2026-10-20 지적) — 50년이 되는 집도 체증식이면 40년으로 계산하고, 50년은 원리금균등만이라고 알린다
    const years = Math.min(maxYears, GRADUATED_MAX_YEARS)
    const notes = [
      i.home === 'one' ? '1주택은 기존 집 처분 조건' : '',
      maxYears > GRADUATED_MAX_YEARS
        ? `${maxYears}년은 원리금균등·원금균등만 (체증식은 최대 ${GRADUATED_MAX_YEARS}년)`
        : '',
    ].filter(Boolean)
    raw.push({
      key: 'bogeum',
      name: '보금자리론',
      sub: '정책대출 · 방공제 없음 · 최대 50년 · 아낌e −0.1%',
      note: notes.length ? notes.join(' · ') : undefined,
      blockers: b,
      rate,
      years,
      method: 'grad',
      deduction: deductionLimit(i, true, years),
      ask: 'hf',
    })
    sources.push({
      prod: (i.first ? 42_000 : i.kids >= 2 ? 40_000 : 36_000) * MAN,
      ltv,
      base: low,
      bang: 0,
      inc: principalFor((income * dti) / 100 / 12, rate, years),
      incLabel: `DTI ${dti}%`,
    })
  }

  // ── 은행·보험사 주담대 (강의 71~76쪽)
  {
    const ins = i.lender === 'ins'
    const rt = ins ? RATE_TYPE.cycle : RATE_TYPE[i.rateType]
    const ltv = i.first ? (i.regulated ? 70 : 80) : i.regulated ? 40 : 70
    const regionCap =
      capital || i.regulated
        ? i.kb <= 15 * EOK
          ? 6 * EOK
          : i.kb <= 25 * EOK
            ? 4 * EOK
            : 2 * EOK
        : Infinity
    const stress = capital ? 3.0 : 0.75
    const stressRate = rt.rate + stress * rt.stressRatio
    const future = (noHome && i.worker && FUTURE_INCOME[i.age]) || 0
    const dsr = ins && !i.overheated ? 50 : 40
    const bang = ins || i.mortgageInsurance ? 0 : reg.bang
    raw.push({
      key: 'general',
      name: ins ? '보험사 주담대' : '은행 주담대',
      sub:
        (ins ? '고정금리만 · 방공제 없음 · DSR 50%' : `${rt.label} · 원리금균등`) +
        (i.mortgageInsurance && !ins ? ' · MCI·MCG로 방공제 없음' : ''),
      blockers: [],
      rate: rt.rate,
      years: 30,
      method: 'ann',
      deduction: deductionLimit(i, ins || i.rateType === 'cycle', 30),
      ask: 'consultant',
    })
    sources.push({
      prod: regionCap,
      ltv,
      base: i.kb,
      bang,
      inc: principalFor((income * (1 + future) * dsr) / 100 / 12, stressRate, 30),
      incLabel:
        `DSR ${dsr}% · 스트레스 +${(stress * rt.stressRatio).toFixed(2)}%` +
        (future ? ` · 장래소득 +${Math.round(future * 100)}%` : ''),
    })
  }

  const all: LoanResult[] = raw.map((r, idx) => {
    const s = sources[idx]
    const ltvAmount = (s.base * s.ltv) / 100 - s.bang
    const parts = [
      { label: '상품·지역 한도', amount: s.prod },
      {
        label:
          `LTV ${s.ltv}%` + (s.bang ? ` − 방공제 ${(s.bang / MAN).toLocaleString('ko-KR')}만` : ''),
        amount: ltvAmount,
      },
      { label: s.incLabel, amount: s.inc },
    ]
    const limit = Math.max(0, Math.min(s.prod, ltvAmount, s.inc))
    const use = Math.min(limit, need)
    const plans = use > 0 ? repaymentPlans(use, r.rate, r.years) : null
    return {
      ...r,
      parts,
      limit,
      use,
      plans,
      firstPayment: plans ? plans[r.method].first : 0,
      enough: limit >= need,
    }
  })
  // 유리한 순 — 필요한 만큼 나오는 것 먼저, 그다음 첫 달 갚는 돈이 적은 것
  const loans = all
    .filter((l) => l.blockers.length === 0)
    .sort((a, b) => Number(b.enough) - Number(a.enough) || a.firstPayment - b.firstPayment)
  const affordable = principalFor(i.monthly, 4.8, 30) // 강의 29쪽: 30년 · 4.8% · 원리금균등
  const best = loans[0] ?? null
  return {
    need,
    affordable,
    incomeTimesFive: income * 5,
    loans,
    blocked: all.filter((l) => l.blockers.length > 0),
    best,
    canBuy: i.own + (best ? Math.min(best.limit, affordable) : 0),
  }
}
