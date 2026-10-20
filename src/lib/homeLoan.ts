/**
 * 내집마련 대출 찾기 (2026-10-20) — 원팀 프로젝트 2강 '내 집 마련을 위한 대출의 이해'를 뼈대로,
 * 숫자는 2026-10-20에 공식 자료로 다시 확인해 맞췄다 (강의와 다른 곳은 근거를 주석에).
 * 우리 조건을 넣으면 디딤돌·신생아 특례·보금자리론·은행(보험사) 주담대를 받을 수 있는지, 한도와 첫 달 갚는 돈을 낸다.
 * 숫자는 모두 이 파일 한 곳에. 정책이 바뀌면 여기만 고치고 HOME_LOAN_BASE_DATE를 올린다.
 *
 * 한도 = 셋 중 가장 작은 값 (강의 43~45쪽): 상품·지역 한도 / LTV − 방공제 / 소득(정책=DTI, 은행=DSR+스트레스)
 * 방공제는 LTV 쪽에서만 뺀다. 금액은 원 단위.
 *
 * 출처 (2026-10-20 확인)
 * - 디딤돌·신생아 특례: 주택도시기금 myhome.go.kr 상품 안내 (금리표·한도·LTV·DTI·소득·순자산)
 * - 디딤돌 방공제: 수도권 아파트만 차감, 연소득 4천 이하·3억 이하 예외, 신생아 특례 제외 (국토부 2024.11 관리방안, 매일신문 2026.10.10)
 * - 보금자리론: 주택금융공사 hf.go.kr (규제지역 LTV·DTI −10%p·실수요자 제외, 40·50년 나이, 체증식 만 40세 미만,
 *   규제지역 +0.2%p), 10월 아낌e 금리 (아시아경제 2026.9.28)
 * - 스트레스 DSR: 은행연합회 스트레스금리 공시(2026.6.30 기준, 2026.12.31까지) — 수도권·규제 3.0%, 지방 0.75%,
 *   혼합형(5년 고정) 80%·주기형(5년) 40%·변동 100%
 * - 수도권·규제 주담대 가격별 한도 15억 6억 / 25억 4억 / 그 이상 2억 (금융위 10.15 대책)
 * - 방공제 금액: 주택임대차보호법 시행령 최우선변제금
 */
export const HOME_LOAN_BASE_DATE = '2026년 10월 20일'

/** 체증식 최대 기간 — 보금자리론이 50년까지 되어도 체증식은 40년까지 */
export const GRADUATED_MAX_YEARS = 40

const MAN = 10_000
const EOK = 100_000_000

export type Region = 'seoul' | 'dense' | 'gyeonggi' | 'sejong' | 'city' | 'other'
export type AgeBand = 'u35' | '35' | '40' | '50'
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
  area: Area
  rateType: RateType
  lender: Lender
  mortgageInsurance: boolean // MCI·MCG — 방공제 없이
}

/**
 * 지역 — 칩 하나로 수도권 여부와 방공제(최우선변제금)가 같이 정해진다.
 * '경기 그 밖'은 파주·평택·이천·안산·광주 2,800만과 나머지 2,500만이 섞여 있어, 더 많이 깎이는 2,800만으로 본다
 * (한도를 실제보다 크게 보여주지 않게).
 */
export const REGION: Record<
  Region,
  { label: string; bang: number; capital: boolean; hint?: string }
> = {
  seoul: { label: '서울', bang: 5_500 * MAN, capital: true },
  dense: {
    label: '경기·인천 과밀억제권역',
    bang: 4_800 * MAN,
    capital: true,
    hint: '용인·화성·김포도 여기예요',
  },
  gyeonggi: {
    label: '경기 그 밖',
    bang: 2_800 * MAN,
    capital: true,
    hint: '파주·평택·이천·안산·광주는 방공제 2,800만, 나머지 경기는 2,500만이에요. 더 깎이는 2,800만으로 계산해요',
  },
  sejong: { label: '세종', bang: 4_800 * MAN, capital: false },
  city: {
    label: '지방 광역시',
    bang: 2_800 * MAN,
    capital: false,
    hint: '광역시의 군 지역은 그 밖 지방',
  },
  other: { label: '그 밖 지방', bang: 2_500 * MAN, capital: false },
}

/** 금리 유형 — 은행 금리는 강의 76쪽 최저 금리 어림(혼합형은 사이값) */
export const RATE_TYPE: Record<RateType, { label: string; rate: number }> = {
  cycle: { label: '주기형 (5년)', rate: 5.2 },
  mix: { label: '혼합형 (5년 고정)', rate: 5.0 },
  var: { label: '변동형', rate: 4.7 },
}

/** 스트레스 금리(%p) — 은행연합회 공시: 수도권·규제 3.0 × (변동 100% · 혼합 80% · 주기 40%), 지방 0.75 기준 */
export const STRESS: Record<'capital' | 'local', Record<RateType, number>> = {
  capital: { var: 3.0, mix: 2.4, cycle: 1.2 },
  local: { var: 0.75, mix: 0.45, cycle: 0.23 },
}

/** 디딤돌 금리표 30년 만기 (부부 합산 연소득 상한, 금리 %) — 지방 −0.2%p */
const DIDIM_RATE_30: [number, number][] = [
  [2_000 * MAN, 3.1],
  [4_000 * MAN, 3.45],
  [7_000 * MAN, 3.8],
  [8_500 * MAN, 4.15],
]

/** 신생아 특례 금리표 30년 만기 — 지방 −0.2%p */
const BABY_RATE_30: [number, number][] = [
  [2_000 * MAN, 2.05],
  [4_000 * MAN, 2.4],
  [6_000 * MAN, 2.65],
  [8_500 * MAN, 2.9],
  [1 * EOK, 3.2],
  [1.3 * EOK, 3.5],
  [1.5 * EOK, 3.8],
  [1.7 * EOK, 4.15],
  [2 * EOK, 4.5],
]

/** 보금자리론 10월 아낌e 금리 (만기별) — 규제지역 +0.2%p, 우대금리 최대 1.0%p 별도 */
const BOGEUM_RATE: Record<number, number> = {
  10: 4.9,
  15: 5.0,
  20: 5.05,
  30: 5.1,
  40: 5.15,
  50: 5.2,
}

const fromTable = (t: [number, number][], income: number) =>
  (t.find(([max]) => income <= max) ?? t[t.length - 1])[1]

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
  /** 금리 옆 한 줄 (우대·가산 안내) */
  rateNote: string
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

/** 장기주택저당차입금 이자 소득공제 한도 (강의 22~24쪽) — 고정금리엔 5년 이상 주기형 포함 */
function deductionLimit(i: LoanFinderInput, fixed: boolean, years: number): number {
  const pub = i.publicPrice > 0 ? i.publicPrice : i.kb * 0.7
  if (!i.worker || pub > 6 * EOK) return 0
  if (years >= 15) return fixed ? 2_000 * MAN : 1_800 * MAN // 모두 비거치 분할상환으로 본다
  if (years >= 10) return 600 * MAN
  return 0
}

type Raw = Omit<LoanResult, 'parts' | 'limit' | 'use' | 'plans' | 'firstPayment' | 'enough'> & {
  src: { prod: number; ltv: number; base: number; bang: number; inc: number; incLabel: string }
}

export function findLoans(i: LoanFinderInput): LoanFinderResult {
  const income = i.income1 + i.income2
  const reg = REGION[i.region]
  const capital = reg.capital
  const noHome = i.home === 'none'
  const low = Math.min(i.deal, i.kb)
  const need = Math.max(0, i.deal - i.own)
  const areaOk = i.area === '85' || (i.area === '100' && i.eup && !capital)
  const under40 = i.age === 'u35' || i.age === '35'
  // 생애최초 LTV 80%, 수도권·규제지역은 70% (6.27 대책)
  const policyLtv = i.first ? (capital || i.regulated ? 70 : 80) : 70
  const localCut = capital ? 0 : 0.2 // 기금대출 지방 소재 주택 −0.2%p
  const raw: Raw[] = []

  // ── 디딤돌
  {
    const b: string[] = []
    const priceMax = (i.newly || i.kids >= 2 ? 6 : 5) * EOK
    const incomeMax = (i.newly ? 8_500 : i.first || i.kids >= 2 ? 7_000 : 6_000) * MAN
    if (!noHome) b.push('세대원 모두 집이 없어야 해요')
    if (!i.assetOk) b.push('순자산 5.11억 이하')
    if (!areaOk) b.push('전용 85㎡ 이하 (수도권 밖 읍·면 100㎡)')
    if (low > priceMax) b.push(`집값 ${priceMax / EOK}억 이하`)
    if (income > incomeMax) b.push(`부부 소득 ${(incomeMax / MAN).toLocaleString('ko-KR')}만 이하`)
    const rate = fromTable(DIDIM_RATE_30, income) - localCut
    // 방공제: 수도권 아파트만 (생애최초도 차감), 연소득 4천 이하·3억 이하 집은 예외. 지방은 없음
    const bang = capital && !(low <= 3 * EOK && income <= 4_000 * MAN) ? reg.bang : 0
    raw.push({
      key: 'didim',
      name: '디딤돌',
      sub: '정책대출 · 낮은 금리 · DSR 안 봄',
      blockers: b,
      rate,
      rateNote: '금리 방식(5년 변동·10년 고정·순수 고정)에 따라 +0.1~0.3%p, 우대 최대 0.5%p',
      years: 30,
      method: 'grad',
      deduction: deductionLimit(i, true, 30),
      ask: 'fund',
      src: {
        prod: (i.newly || i.kids >= 2 ? 32_000 : i.first ? 24_000 : 20_000) * MAN,
        ltv: policyLtv,
        base: low,
        bang,
        inc: principalFor((income * 0.6) / 12, rate, 30),
        incLabel: 'DTI 60%',
      },
    })
  }

  // ── 신생아 특례
  {
    const b: string[] = []
    const both = i.income1 > 0 && i.income2 > 0
    if (!i.baby) b.push('2년 안에 출산한 아이가 있어야 해요')
    if (!noHome) b.push('집이 없어야 해요 (1주택은 갈아타기만)')
    if (both) {
      if (income > 2 * EOK) b.push('맞벌이 합산 소득 2억 이하')
      if (i.income1 > 1.3 * EOK || i.income2 > 1.3 * EOK) b.push('부부 각자 소득 1.3억 이하')
    } else if (income > 1.3 * EOK) b.push('부부 소득 1.3억 이하')
    if (!i.assetOk) b.push('순자산 5.11억 이하')
    if (!areaOk) b.push('전용 85㎡ 이하')
    if (low > 9 * EOK) b.push('집값 9억 이하')
    const rate = fromTable(BABY_RATE_30, income) - localCut
    raw.push({
      key: 'baby',
      name: '신생아 특례',
      sub: '정책대출 · 방공제 없음 · 특례 금리 아이 1명당 5년',
      blockers: b,
      rate,
      rateNote: '특례 금리는 5년 (2년 안에 추가 출산하면 1명당 +5년, 최장 15년)',
      years: 30,
      method: 'grad',
      deduction: deductionLimit(i, true, 30),
      ask: 'fund',
      // 방공제·후취담보 제한 모두 제외 (국토부 2024.11)
      src: {
        prod: 4 * EOK,
        ltv: policyLtv,
        base: low,
        bang: 0,
        inc: principalFor((income * 0.6) / 12, rate, 30),
        incLabel: 'DTI 60%',
      },
    })
  }

  // ── 보금자리론
  {
    const b: string[] = []
    let incomeOk: boolean
    if (i.kids >= 2) incomeOk = income <= 1 * EOK
    else if (i.kids === 1) incomeOk = income <= 9_000 * MAN
    // 신혼(혼인 7년 이내): 합산 8,500만 이하, 또는 부부 중 한 명이 7,000만 이하 (2026.10.19 신규 신청분부터)
    else if (i.newly)
      incomeOk = income <= 8_500 * MAN || i.income1 <= 7_000 * MAN || i.income2 <= 7_000 * MAN
    else incomeOk = income <= 7_000 * MAN
    if (i.deal > 6 * EOK || i.kb > 6 * EOK) b.push('시세·매매가 모두 6억 이하')
    if (!incomeOk)
      b.push(
        i.newly
          ? '합산 8,500만 이하 또는 한 명이 7,000만 이하'
          : `부부 소득 ${i.kids >= 2 ? '1억' : i.kids === 1 ? '9,000만' : '7,000만'} 이하`,
      )
    const seomin = noHome && low <= 6 * EOK && income <= 7_000 * MAN // 서민실수요자 — 규제지역 차감 없음
    let ltv = 70
    let dti = 60
    if (i.first) ltv = capital || i.regulated ? 70 : 80
    else if (i.regulated && !seomin) {
      ltv = 60
      dti = 50
    }
    // 40년: 만 40세 미만(신혼 만 50세 미만) · 50년: 만 35세 미만(신혼 만 40세 미만)
    const maxYears =
      i.age === 'u35'
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
    // 체증식은 만 40세 미만만, 최대 40년
    const method: Method = under40 ? 'grad' : 'ann'
    const years = method === 'grad' ? Math.min(maxYears, GRADUATED_MAX_YEARS) : maxYears
    const rate = BOGEUM_RATE[years] + (i.regulated ? 0.2 : 0)
    const notes = [
      i.home === 'one' ? '1주택은 기존 집 처분 조건' : '',
      method === 'grad' && maxYears > GRADUATED_MAX_YEARS
        ? `${maxYears}년은 원리금균등·원금균등만 (체증식은 최대 ${GRADUATED_MAX_YEARS}년)`
        : '',
      method === 'ann' ? '체증식은 만 40세 미만만' : '',
    ].filter(Boolean)
    raw.push({
      key: 'bogeum',
      name: '보금자리론',
      sub: '정책대출 · 방공제 없음(아파트) · 최대 50년',
      note: notes.length ? notes.join(' · ') : undefined,
      blockers: b,
      rate,
      rateNote: `10월 아낌e 금리${i.regulated ? ' + 규제지역 0.2%p' : ''} · 우대 최대 1.0%p (신혼 0.3, 2자녀 0.5 등)`,
      years,
      method,
      deduction: deductionLimit(i, true, years),
      ask: 'hf',
      src: {
        prod: (i.first ? 42_000 : i.kids >= 2 ? 40_000 : 36_000) * MAN,
        ltv,
        base: low,
        bang: 0,
        inc: principalFor((income * dti) / 100 / 12, rate, years),
        incLabel: `DTI ${dti}%`,
      },
    })
  }

  // ── 은행·보험사 주담대
  {
    const ins = i.lender === 'ins'
    const type: RateType = ins ? 'cycle' : i.rateType
    const rt = RATE_TYPE[type]
    const ltv = i.first ? (capital || i.regulated ? 70 : 80) : i.regulated ? 40 : 70
    const regionCap =
      capital || i.regulated
        ? i.kb <= 15 * EOK
          ? 6 * EOK
          : i.kb <= 25 * EOK
            ? 4 * EOK
            : 2 * EOK
        : Infinity
    const stress = STRESS[capital || i.regulated ? 'capital' : 'local'][type]
    const dsr = ins ? 50 : 40
    const bang = ins || i.mortgageInsurance ? 0 : reg.bang
    raw.push({
      key: 'general',
      name: ins ? '보험사 주담대' : '은행 주담대',
      sub:
        (ins ? '고정금리 · 방공제 없음 · DSR 50%' : `${rt.label} · 원리금균등`) +
        (i.mortgageInsurance && !ins ? ' · MCI·MCG로 방공제 없음' : ''),
      blockers: [],
      rate: rt.rate,
      rateNote: '최저 금리 어림 — 은행·시기마다 달라요',
      years: 30,
      method: 'ann',
      deduction: deductionLimit(i, ins || type === 'cycle', 30),
      ask: 'consultant',
      src: {
        prod: regionCap,
        ltv,
        base: i.kb,
        bang,
        inc: principalFor((income * dsr) / 100 / 12, rt.rate + stress, 30),
        incLabel: `DSR ${dsr}% · 스트레스 +${stress.toFixed(2)}%p`,
      },
    })
  }

  const all: LoanResult[] = raw.map(({ src: s, ...r }) => {
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
