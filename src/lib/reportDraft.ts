import type { AssetSnapshot, MonthlyLedger, OccasionEntry, Profile } from '../types'
import { netWorthOf, resolveSnapshot, summarize, totalAssets, totalDebts } from './carryover'
import { abbreviateKRW, formatWon } from './format'

/**
 * 맞춤 리포트 초안 자동 생성.
 *
 * 운영자가 빈 화면에서 시작하지 않게, 데이터에서 뽑을 수 있는 것은 전부 뽑아
 * 문장까지 만들어 둔다. 사람이 할 일은 '읽고 고치기'만 남기는 게 목표.
 * 규칙 기반이라 같은 데이터면 같은 초안이 나온다(검토가 쉬워진다).
 */

export interface HouseholdData {
  profile: Profile
  ledgers: MonthlyLedger[]
  snapshots: AssetSnapshot[]
  occasions: OccasionEntry[]
}

/** 전체 가구 저축률 분포 (우리집 위치 계산용) */
export interface Benchmark {
  rates: number[]
}

export interface ReportStats {
  months: number // 결산을 마친 달 수
  latestYm: string | null
  avgIncome: number
  avgExpense: number
  avgSavingInvest: number
  savingRate: number
  surplus: number
  netWorth: number
  assets: number
  debts: number
  emergencyMonths: number // 현금성 자산 ÷ 월 지출
  fixedRatio: number // 고정지출 ÷ 수입
  debtRatio: number // 부채 ÷ 자산
  topVariable: { category: string; amount: number }[]
  occasionMonthly: number // 비정기 지출 연간 합계 ÷ 12
  yearsToTarget: number | null
  hasHousingSubscription: boolean
  percentile: number | null // 상위 몇 %인지 (낮을수록 좋음)
}

const MONTHS_TO_AVERAGE = 6

/** 결산을 마친 최근 달들 (최신순) */
function closedLedgers(ledgers: MonthlyLedger[]): MonthlyLedger[] {
  return [...ledgers]
    .filter((l) => l.closed && l.items.length > 0)
    .sort((a, b) => (a.ym < b.ym ? 1 : -1))
    .slice(0, MONTHS_TO_AVERAGE)
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}

/** 저축률이 전체에서 상위 몇 %인지 (1 = 최상위) */
export function percentileOf(rate: number, rates: number[]): number | null {
  if (rates.length < 5) return null // 표본이 적으면 말하지 않는다
  const better = rates.filter((r) => r > rate).length
  return Math.max(1, Math.round(((better + 1) / (rates.length + 1)) * 100))
}

export function computeReportStats(d: HouseholdData, bench?: Benchmark): ReportStats {
  const recent = closedLedgers(d.ledgers)
  const sums = recent.map((l) => summarize(l))

  const avgIncome = avg(sums.map((s) => s.income))
  const avgExpense = avg(sums.map((s) => s.expense))
  const avgSavingInvest = avg(sums.map((s) => s.saving + s.investment))
  const avgFixed = avg(sums.map((s) => s.fixed))
  const savingRate = avgIncome > 0 ? avgSavingInvest / avgIncome : 0

  const latestYm = recent[0]?.ym ?? null
  const snap = latestYm ? resolveSnapshot(d.snapshots, latestYm) : { ym: '', items: [] }
  const netWorth = netWorthOf(snap)
  const assets = totalAssets(snap)
  const debts = totalDebts(snap)
  const cash = snap.items
    .filter((it) => it.kind === 'asset' && it.group === 'cash')
    .reduce((a, it) => a + it.amount, 0)

  // 변동지출 상위 카테고리 (최근 달들 합산)
  const varMap = new Map<string, number>()
  for (const l of recent) {
    for (const it of l.items) {
      if (it.group !== 'variable') continue
      varMap.set(it.category, (varMap.get(it.category) ?? 0) + it.actual)
    }
  }
  const topVariable = [...varMap.entries()]
    .map(([category, total]) => ({ category, amount: recent.length ? total / recent.length : 0 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)

  // 비정기 지출 — 최근 12개월
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  const occYear = d.occasions
    .filter((o) => new Date(o.date) >= cutoff)
    .reduce((a, o) => a + o.amount, 0)

  const monthlySave = avgSavingInvest
  const remaining = d.profile.targetNetWorth - netWorth
  const yearsToTarget =
    monthlySave > 0 && remaining > 0 ? remaining / (monthlySave * 12) : remaining <= 0 ? 0 : null

  const hasHousingSubscription =
    snap.items.some((it) => it.name.includes('청약')) ||
    recent.some((l) => l.items.some((it) => it.category.includes('청약')))

  return {
    months: recent.length,
    latestYm,
    avgIncome,
    avgExpense,
    avgSavingInvest,
    savingRate,
    surplus: avg(sums.map((s) => s.surplus)),
    netWorth,
    assets,
    debts,
    emergencyMonths: avgExpense > 0 ? cash / avgExpense : 0,
    fixedRatio: avgIncome > 0 ? avgFixed / avgIncome : 0,
    debtRatio: assets > 0 ? debts / assets : 0,
    topVariable,
    occasionMonthly: occYear / 12,
    yearsToTarget,
    hasHousingSubscription,
    percentile: bench ? percentileOf(savingRate, bench.rates) : null,
  }
}

// ── 진단 규칙 ─────────────────────────────────
export interface DraftIssue {
  key: string
  title: string
  body: string
  action: string
}

/**
 * 급한 순서대로 문제를 고른다.
 *
 * 순서에 뜻이 있다: 돈이 새는 것(적자) → 무너질 때 버틸 것(비상금) →
 * 이자 나가는 것(부채) → 못 모으는 것(저축률·고정비) → 놓치는 것(청약·비정기).
 */
export function pickIssues(s: ReportStats): DraftIssue[] {
  const out: DraftIssue[] = []

  if (s.surplus < 0) {
    out.push({
      key: 'deficit',
      title: '매달 적자입니다',
      body: `최근 ${s.months}개월 평균으로 매달 ${formatWon(Math.abs(s.surplus))}씩 모자랍니다. 저축을 늘리기 전에 이것부터 막아야 해요.`,
      action: `변동지출 1위인 ${s.topVariable[0]?.category ?? '식비'}부터 한 달 예산을 정해두세요.`,
    })
  }

  if (s.emergencyMonths < 3) {
    out.push({
      key: 'emergency',
      title: '비상금이 얇습니다',
      body: `현금성 자산이 생활비 ${s.emergencyMonths.toFixed(1)}개월치예요. 아프거나 일이 끊기면 바로 빚으로 갑니다.`,
      action: `월 지출 3개월치(${formatWon(s.avgExpense * 3)})가 모일 때까지 비상금 통장을 따로 두세요.`,
    })
  }

  if (s.debtRatio > 0.5) {
    out.push({
      key: 'debt',
      title: '부채 비중이 높습니다',
      body: `자산 대비 부채가 ${Math.round(s.debtRatio * 100)}%예요. 투자보다 상환이 먼저입니다.`,
      action: '금리가 높은 대출부터 순서를 정해 갚아 나가세요.',
    })
  }

  if (s.savingRate < 0.2 && s.surplus >= 0) {
    out.push({
      key: 'saving',
      title: '저축률이 낮습니다',
      body: `수입의 ${Math.round(s.savingRate * 100)}%만 모으고 있어요. 이 속도로는 목표가 계속 멀어집니다.`,
      action: '월급날 저축부터 자동이체로 빼두고 남은 돈으로 사세요.',
    })
  }

  if (s.fixedRatio > 0.5) {
    out.push({
      key: 'fixed',
      title: '고정지출이 무겁습니다',
      body: `수입의 ${Math.round(s.fixedRatio * 100)}%가 매달 자동으로 나갑니다. 한 번 줄이면 계속 남아요.`,
      action: '보험·통신·구독 세 가지를 이번 달에 한 번씩 열어보세요.',
    })
  }

  if (!s.hasHousingSubscription) {
    out.push({
      key: 'subscription',
      title: '주택청약이 없습니다',
      body: '내집마련이 목표라면 청약통장은 가장 싼 준비물이에요. 월 2만원이면 시작합니다.',
      action: '두 분 각자 청약통장을 만들고 자동이체를 걸어두세요.',
    })
  }

  if (s.occasionMonthly > s.avgIncome * 0.05 && s.avgIncome > 0) {
    out.push({
      key: 'occasion',
      title: '비정기 지출이 예산을 흔듭니다',
      body: `경조사·명절 같은 지출이 월 ${formatWon(s.occasionMonthly)} 꼴로 나갑니다. 예산에 없으면 매번 저축이 밀려요.`,
      action: `연간비 통장을 만들고 매달 ${formatWon(Math.round(s.occasionMonthly / 10000) * 10000)}씩 미리 넣어두세요.`,
    })
  }

  return out
}

/** 우리집 위치 한 줄 */
export function positionLine(s: ReportStats): string {
  if (s.percentile == null) return ''
  if (s.percentile <= 30) return `모아불리를 쓰는 가구 중 상위 ${s.percentile}%예요. 잘하고 계십니다.`
  if (s.percentile <= 70) return `모아불리를 쓰는 가구 중 상위 ${s.percentile}% 언저리예요. 딱 중간입니다.`
  return `모아불리를 쓰는 가구 중 상위 ${s.percentile}%예요. 지금부터 올리면 됩니다.`
}

/** 초안 본문 (운영자가 고쳐 쓰는 원고) */
export function buildReportDraft(d: HouseholdData, bench?: Benchmark): string {
  const s = computeReportStats(d, bench)
  const [n1, n2] = [d.profile.member1Name, d.profile.member2Name]

  if (s.months === 0) {
    return [
      `${n1}·${n2} 님 안녕하세요, 결영이네입니다.`,
      '',
      '아직 정산을 마친 달이 없어서 숫자를 볼 수 없었어요.',
      '한 달만 정산해 주시면 바로 리포트를 만들어 보내드릴게요.',
    ].join('\n')
  }

  const issues = pickIssues(s)
  const top = issues[0]
  const three = issues.slice(0, 3)
  const rate = Math.round(s.savingRate * 100)

  const L: string[] = []
  L.push(`${n1}·${n2} 님, 결영이네입니다.`)
  L.push('')
  L.push(`최근 ${s.months}개월 숫자를 봤어요. 한 줄로 말씀드리면 —`)
  L.push('')
  L.push(
    top
      ? `**${top.title}.** ${top.body}`
      : `**잘 굴러가고 있습니다.** 저축률 ${rate}%로 꾸준히 모으고 계세요.`,
  )
  L.push('')

  L.push('## 우리집 숫자')
  L.push('')
  L.push(`- 월 평균 수입: ${formatWon(s.avgIncome)}`)
  L.push(`- 월 평균 지출: ${formatWon(s.avgExpense)}`)
  L.push(`- 월 평균 저축·투자: ${formatWon(s.avgSavingInvest)} (저축률 ${rate}%)`)
  L.push(`- 순자산: ${abbreviateKRW(s.netWorth)} (자산 ${abbreviateKRW(s.assets)} − 부채 ${abbreviateKRW(s.debts)})`)
  L.push(`- 비상금: 생활비 ${s.emergencyMonths.toFixed(1)}개월치`)
  if (s.topVariable.length) {
    L.push(
      `- 변동지출 큰 순서: ${s.topVariable.map((v) => `${v.category} ${formatWon(v.amount)}`).join(' / ')}`,
    )
  }
  L.push('')

  L.push('## 10년 목표까지')
  L.push('')
  L.push(`목표는 ${abbreviateKRW(d.profile.targetNetWorth)}, 지금은 ${abbreviateKRW(s.netWorth)}입니다.`)
  if (s.yearsToTarget === 0) {
    L.push('이미 목표를 넘기셨어요. 다음 목표를 새로 잡을 때입니다.')
  } else if (s.yearsToTarget == null) {
    L.push('지금 저축 속도로는 도달 시점을 계산할 수 없어요. 저축부터 다시 시작해야 합니다.')
  } else {
    L.push(
      `지금 속도(월 ${formatWon(s.avgSavingInvest)})로는 **약 ${s.yearsToTarget.toFixed(1)}년** 걸립니다.` +
        (s.yearsToTarget > 10 ? ' 10년 안에 넣으려면 저축을 더 올려야 해요.' : ' 10년 안에 들어옵니다.'),
    )
  }
  const pos = positionLine(s)
  if (pos) {
    L.push('')
    L.push(pos)
  }
  L.push('')

  L.push('## 지금 제일 급한 것')
  L.push('')
  if (top) {
    L.push(`**${top.title}**`)
    L.push('')
    L.push(top.body)
    L.push('')
    L.push(`→ ${top.action}`)
  } else {
    L.push('급한 문제는 없습니다. 지금 흐름을 유지하세요.')
  }
  L.push('')

  L.push('## 다음 3개월에 할 일')
  L.push('')
  if (three.length) {
    three.forEach((it, i) => L.push(`${i + 1}. ${it.action}`))
  } else {
    L.push('1. 지금 저축률을 그대로 유지하세요.')
    L.push('2. 비정기 지출이 생기면 그 달에 바로 기록해 두세요.')
    L.push('3. 3개월 뒤 순자산이 얼마나 늘었는지 확인해 보세요.')
  }
  L.push('')

  L.push('## 점검표')
  L.push('')
  L.push(`- 통장 쪼개기: ${s.emergencyMonths >= 3 ? '비상금 확보됨 ✓' : '비상금 통장 분리 필요'}`)
  L.push(`- 보험: 고정지출 비중 ${Math.round(s.fixedRatio * 100)}%${s.fixedRatio > 0.5 ? ' — 점검 필요' : ' — 무난함 ✓'}`)
  L.push(`- 청약: ${s.hasHousingSubscription ? '있음 ✓' : '없음 — 개설 권장'}`)
  L.push('')
  L.push('---')
  L.push('')
  L.push('여기까지가 리포트예요. 궁금한 점은 편하게 답장 주세요.')
  L.push('')
  L.push(
    "이 숫자를 놓고 '그래서 우리집은 언제 집 사?'까지 가고 싶으시면 1:1 내집마련 상담에서 이어서 봐요.",
  )
  L.push('수입 쪽을 키우고 싶은 분께는 부수입 상담도 있어요. 답장으로 물어보시면 안내드릴게요.')
  L.push('')
  L.push('다음 달에도 잘 모아봐요 🤍')
  L.push('')
  L.push('결영이네 드림')

  return L.join('\n')
}
