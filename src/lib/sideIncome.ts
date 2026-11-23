// ── 부수입 가계부 (2026-11-19) ──
// 살림 가계부와 따로 적고 따로 정산한다. 두 가지로 나눠 센다.
//   들어온 돈(cash) — 통장에 실제로 들어온 돈: 앱테크 출금·원고료·중고 판매·기프티콘 판매…
//   아낀 돈(saved)  — 안 나간 돈: 체험단·협찬 제품·포인트 결제·기프티콘 사용…
// 월말 부수입 정산에서 들어온 돈만 어디로 보낼지 정한다 (자산 통장 / 살림에 보태기).
// 아낀 돈은 실제로 들어온 돈이 아니라 기록으로만 남긴다 — 생활비 계획이 부풀지 않게.
// 2026-11-23 쓴 돈(spent) — 부수입 때문에 나간 돈(체험단 교통비·프로그램 구독·수수료…). 번 돈에서 빼서
//   '남은 돈'을 보여 주고, 정산 때 보낼 수 있는 돈도 남은 돈까지. 매달 나가는 건 repeat로 다음 달에 저절로.
import { genId } from './carryover'
import { recurringId } from './childRecurring'
import { shiftYm } from './format'
import type { AssetItem, BudgetItem, MonthlyLedger } from '../types'

export type SideKind = 'cash' | 'saved' | 'spent'

export const SIDE_KINDS: SideKind[] = ['cash', 'saved', 'spent']

export const SIDE_KIND_LABEL: Record<SideKind, string> = {
  cash: '번 돈',
  saved: '아낀 돈',
  spent: '쓴 돈',
}

export const SIDE_CATEGORIES: Record<SideKind, string[]> = {
  // 2026-11-23 결영 요청으로 번 돈을 잘게 — 원고료·협찬비를 나누고 광고 수익·지식 판매·강의·상담을 더했다.
  // 예전에 '원고료·협찬비'·'캐시백·포인트 출금'으로 적은 기록은 그 이름 그대로 남는다(직접 쓴 종류처럼).
  cash: [
    '원고료',
    '협찬비',
    '광고 수익',
    '지식 판매',
    '강의·상담',
    '앱테크',
    '중고 판매',
    '기프티콘 판매',
    '캐시백·포인트',
    '기타',
  ],
  saved: ['체험단', '협찬 제품', '포인트 결제', '기프티콘 사용', '기타'],
  spent: ['교통비', '구독·프로그램', '수수료', '재료·소모품', '장비', '광고비', '기타'],
}

/** 종류를 고르면 아래에 보여 주는 한 줄 — 어떤 돈이 여기 들어가는지 */
export const SIDE_CATEGORY_HINT: Record<string, string> = {
  원고료: '블로그·기고·체험단 리뷰 글값',
  협찬비: '브랜드 광고 협찬·유료 광고 게시',
  '광고 수익': '애드포스트·애드센스·유튜브 수익',
  '지식 판매': '전자책·템플릿·노션·자료 판매',
  '강의·상담': '클래스·강의·코칭·컨설팅',
  앱테크: '캐시워크·토스 같은 앱에서 모은 돈 출금',
  '중고 판매': '당근·번개장터에 판 돈',
  '기프티콘 판매': '팔라고·니콘내콘에 판 기프티콘',
  '캐시백·포인트': '카드 캐시백·포인트를 현금으로',
}

/**
 * 엑셀·붙여넣기에서 자주 쓰는 다른 이름 → 종류. 원래 글은 메모로 남긴다.
 * 예: '애드포스트' → 광고 수익(메모 애드포스트)
 */
export const SIDE_CATEGORY_ALIAS: Record<string, string> = {
  애드포스트: '광고 수익',
  애드센스: '광고 수익',
  유튜브: '광고 수익',
  전자책: '지식 판매',
  템플릿: '지식 판매',
  강의: '강의·상담',
  클래스: '강의·상담',
  코칭: '강의·상담',
  컨설팅: '강의·상담',
  당근: '중고 판매',
  번개장터: '중고 판매',
  협찬: '협찬비',
  원고: '원고료',
  '원고료·협찬비': '원고료',
  '캐시백·포인트 출금': '캐시백·포인트',
}

export interface SideIncome {
  id: string
  /** 번 사람 (공동이면 적은 사람) */
  memberNo: 1 | 2
  shared?: boolean
  kind: SideKind
  category: string
  /** 들어온 돈 / 아낀 돈 */
  amount: number
  /** 아낀 돈: 원래 얼마짜리였나 */
  price?: number
  /** 아낀 돈: 그중 내가 낸 돈 */
  paid?: number
  note?: string
  /** 'YYYY-MM-DD' */
  earnedOn: string
  createdAt: string
  /** 매달 (다음 달에 같은 날 저절로 적는다) */
  repeat?: boolean
  /** 매달 적은 것끼리 묶는 번호 — 처음 기록의 id */
  series?: string
}

/** 부수입 정산에서 들어온 돈을 보낸 곳 */
export type SideAllocation =
  | { to: 'asset'; assetId: string; assetName: string; amount: number }
  | { to: 'living'; amount: number; split: { 1: number; 2: number } }

export interface SideSettlement {
  ym: string
  allocations: SideAllocation[]
  closedAt: string
}

/** 아낀 돈 = 원래 값 − 내가 낸 돈 (음수면 0) */
export const savedAmount = (price: number, paid: number) => Math.max(0, price - paid)

export const ymOfDate = (d: string) => d.slice(0, 7)

export interface SideSummary {
  cash: number
  saved: number
  spent: number
  /** 번 돈 − 쓴 돈 */
  net: number
  /** 번 돈 + 아낀 돈 − 쓴 돈 */
  total: number
  /** 누가 — 공동은 따로 */
  byWho: { 1: number; 2: number; shared: number }
  byCategory: Record<SideKind, { category: string; amount: number }[]>
}

export function summarizeSide(entries: SideIncome[], ym: string): SideSummary {
  const out: SideSummary = {
    cash: 0,
    saved: 0,
    spent: 0,
    net: 0,
    total: 0,
    byWho: { 1: 0, 2: 0, shared: 0 },
    byCategory: { cash: [], saved: [], spent: [] },
  }
  const cats: Record<SideKind, Map<string, number>> = {
    cash: new Map(),
    saved: new Map(),
    spent: new Map(),
  }
  for (const e of entries) {
    if (ymOfDate(e.earnedOn) !== ym || e.amount <= 0) continue
    out[e.kind] += e.amount
    // 누가 — 쓴 돈은 뺀다
    const v = e.kind === 'spent' ? -e.amount : e.amount
    if (e.shared) out.byWho.shared += v
    else out.byWho[e.memberNo] += v
    cats[e.kind].set(e.category, (cats[e.kind].get(e.category) ?? 0) + e.amount)
  }
  out.net = out.cash - out.spent
  out.total = out.cash + out.saved - out.spent
  for (const k of SIDE_KINDS)
    out.byCategory[k] = [...cats[k]]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
  return out
}

/** 올해 합계 (그 해 1월 ~ 그 달) */
export function yearSide(entries: SideIncome[], ym: string) {
  const year = ym.slice(0, 4)
  let cash = 0
  let saved = 0
  let spent = 0
  for (const e of entries) {
    const m = ymOfDate(e.earnedOn)
    if (m.slice(0, 4) !== year || m > ym) continue
    if (e.kind === 'cash') cash += e.amount
    else if (e.kind === 'saved') saved += e.amount
    else spent += e.amount
  }
  return { cash, saved, spent }
}

/**
 * 살림에 보탤 돈을 남편·아내 몫으로 나눈다 — 그 달 들어온 돈을 번 비율대로 (공동은 반반).
 * 아무도 안 벌었으면 정산한 사람 몫으로.
 */
export function livingSplit(
  entries: SideIncome[],
  ym: string,
  amount: number,
  me: 1 | 2,
): { 1: number; 2: number } {
  let w1 = 0
  let w2 = 0
  for (const e of entries) {
    if (e.kind !== 'cash' || ymOfDate(e.earnedOn) !== ym) continue
    if (e.shared) {
      w1 += e.amount / 2
      w2 += e.amount / 2
    } else if (e.memberNo === 1) w1 += e.amount
    else w2 += e.amount
  }
  if (w1 + w2 <= 0) return me === 1 ? { 1: amount, 2: 0 } : { 1: 0, 2: amount }
  const one = Math.round((amount * w1) / (w1 + w2))
  return { 1: one, 2: amount - one }
}

export const allocatedTotal = (allocs: SideAllocation[]) => allocs.reduce((a, x) => a + x.amount, 0)

/**
 * 자산 통장에 보낸 돈을 더하거나(sign 1) 마감을 풀 때 뺀다(sign −1).
 * 그 통장이 없으면(지웠거나 이름이 바뀜) 이름으로 찾고, 그래도 없으면 건너뛴다.
 */
export function applyToAssets(
  items: AssetItem[],
  allocs: SideAllocation[],
  sign: 1 | -1,
): AssetItem[] {
  let next = items
  for (const a of allocs) {
    if (a.to !== 'asset' || a.amount <= 0) continue
    const idx = next.findIndex((it) => it.id === a.assetId)
    const at =
      idx >= 0 ? idx : next.findIndex((it) => it.kind === 'asset' && it.name === a.assetName)
    if (at < 0) continue
    next = next.map((it, i) =>
      i === at ? { ...it, amount: Math.max(0, it.amount + sign * a.amount) } : it,
    )
  }
  return next
}

export const LIVING_CATEGORY = '부수입'

/**
 * 살림에 보탠 돈을 그 달 가계부 '부수입'(들어온 돈) 실제 금액에 더하거나(sign 1) 뺀다(−1).
 * 남편·아내 각자 '부수입' 칸이 없으면 만든다.
 */
export function applyToLedger(
  ledger: MonthlyLedger,
  allocs: SideAllocation[],
  sign: 1 | -1,
): MonthlyLedger {
  const living = allocs.find((a) => a.to === 'living')
  if (!living || living.to !== 'living' || living.amount <= 0) return ledger
  let items: BudgetItem[] = ledger.items
  for (const m of [1, 2] as const) {
    const add = living.split[m]
    if (!add) continue
    const idx = items.findIndex(
      (it) =>
        it.group === 'income' && it.category === LIVING_CATEGORY && it.member === m && !it.shared,
    )
    if (idx >= 0) {
      items = items.map((it, i) =>
        i === idx ? { ...it, actual: Math.max(0, it.actual + sign * add) } : it,
      )
    } else if (sign > 0) {
      items = [
        ...items,
        {
          id: genId(),
          group: 'income',
          category: LIVING_CATEGORY,
          member: m,
          planned: 0,
          actual: add,
        },
      ]
    }
  }
  return { ...ledger, items }
}

// ── 표로 적기 · 엑셀에서 붙여넣기 (2026-11-23) ──

/** 이 종류가 어느 쪽인지 — 아낀 돈 목록에만 있는 이름이면 아낀 돈, 아니면 들어온 돈 */
export function kindOfCategory(category: string): SideKind {
  if (category === '기타') return 'cash'
  if (SIDE_CATEGORIES.spent.includes(category)) return 'spent'
  if (SIDE_CATEGORIES.saved.includes(category)) return 'saved'
  return 'cash'
}

export interface PastedRow {
  earnedOn: string
  kind: SideKind
  category: string
  amount: number
  who: 1 | 2 | 'shared'
  note?: string
  /** '매달' 칸 */
  repeat?: boolean
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** '2026-11-03' · '2026.11.3' · '11/3' · '11월 3일' → 'YYYY-MM-DD' (연도 없으면 year) */
export function parseDateCell(cell: string, year: string): string | null {
  const s = cell.trim()
  let m = s.match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?$/)
  if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`
  m = s.match(/^(\d{2})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})$/)
  if (m) return `20${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`
  m = s.match(/^(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?$/)
  if (m && +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1 && +m[2] <= 31)
    return `${year}-${pad2(+m[1])}-${pad2(+m[2])}`
  return null
}

/** '12,000' · '12000원' · '₩12,000' · '1.2만' → 12000 */
export function parseAmountCell(cell: string): number | null {
  const s = cell.replace(/[\s,₩원+]/g, '')
  if (!s) return null
  const man = s.match(/^(\d+(?:\.\d+)?)만$/)
  if (man) return Math.round(Number(man[1]) * 10_000)
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const n = Math.round(Number(s))
  return n > 0 ? n : null
}

/**
 * 엑셀·구글 시트에서 복사한 여러 줄(칸은 탭으로 나뉜다)을 부수입 기록으로 읽는다.
 * 칸 순서는 따지지 않는다 — 날짜처럼 생긴 칸, 금액처럼 생긴 칸, 종류·누가·들어온/아낀을 알아보고
 * 남는 글은 메모로. 날짜나 금액을 못 읽은 줄(머리줄 등)은 빼고 몇 줄인지 돌려준다.
 */
export function parsePastedRows(
  text: string,
  opts: { year: string; names: [string, string]; me: 1 | 2 },
): { rows: PastedRow[]; skipped: number } {
  const rows: PastedRow[] = []
  let skipped = 0
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .filter((l) => l.trim())
  for (const line of lines) {
    const cells = (line.includes('\t') ? line.split('\t') : [line]).map((c) => c.trim())
    let earnedOn: string | null = null
    let amount: number | null = null
    let kind: SideKind | null = null
    let category: string | null = null
    let who: 1 | 2 | 'shared' | null = null
    let repeat = false
    const rest: string[] = []
    for (const c of cells) {
      if (!c) continue
      if (!earnedOn) {
        const d = parseDateCell(c, opts.year)
        if (d) {
          earnedOn = d
          continue
        }
      }
      if (amount === null) {
        const a = parseAmountCell(c)
        if (a !== null) {
          amount = a
          continue
        }
      }
      if (!kind && /^(들어온\s*돈|들어옴|수입|번\s*돈|현금)$/.test(c)) {
        kind = 'cash'
        continue
      }
      if (!kind && /^(아낀\s*돈|아낌|절약)$/.test(c)) {
        kind = 'saved'
        continue
      }
      if (!kind && /^(쓴\s*돈|지출|비용)$/.test(c)) {
        kind = 'spent'
        continue
      }
      if (c === '매달') {
        repeat = true
        continue
      }
      if (!who) {
        if (c === opts.names[0] || c === '남편') {
          who = 1
          continue
        }
        if (c === opts.names[1] || c === '아내') {
          who = 2
          continue
        }
        if (c === '공동' || c === '함께' || c === '같이') {
          who = 'shared'
          continue
        }
      }
      if (
        !category &&
        [...SIDE_CATEGORIES.cash, ...SIDE_CATEGORIES.saved, ...SIDE_CATEGORIES.spent].includes(c)
      ) {
        category = c
        continue
      }
      if (!category && SIDE_CATEGORY_ALIAS[c]) {
        category = SIDE_CATEGORY_ALIAS[c]
        // 예전 종류 이름(가운뎃점)은 버리고, 애드포스트 같은 이름은 메모로 남긴다
        if (!c.includes('·')) rest.unshift(c)
        continue
      }
      rest.push(c)
    }
    if (!earnedOn || amount === null) {
      skipped++
      continue
    }
    // 종류 칸이 목록에 없는 이름이면 첫 글을 종류로, 나머지는 메모로
    if (!category) category = (rest.shift() ?? '기타').slice(0, 30)
    rows.push({
      earnedOn,
      kind: kind ?? kindOfCategory(category),
      category,
      amount,
      who: who ?? opts.me,
      ...(repeat ? { repeat: true } : {}),
      note: rest.join(' ').slice(0, 100) || undefined,
    })
  }
  return { rows, skipped }
}

// ── 매달 (2026-11-23) ──

const daysIn = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()

/**
 * 매달로 표시한 기록 중 아직 안 적힌 달 — 묶음(series)마다 가장 최근 기록이 '매달'이면
 * 그다음 달부터 오늘까지 같은 날짜(그 달에 없는 날이면 말일)로 만든다.
 * id는 (묶음, 달)로 정해서 두 사람이 동시에 열어도 한 번만 들어간다.
 * 멈추려면 가장 최근 기록의 '매달'을 끄면 된다.
 */
export function dueRepeats(entries: SideIncome[], today: string): SideIncome[] {
  const latest = new Map<string, SideIncome>()
  for (const e of entries) {
    const key = e.series ?? e.id
    const cur = latest.get(key)
    if (!cur || e.earnedOn > cur.earnedOn) latest.set(key, e)
  }
  const out: SideIncome[] = []
  for (const [series, e] of latest) {
    if (!e.repeat) continue
    const day = Number(e.earnedOn.slice(8, 10))
    let ym = ymOfDate(e.earnedOn)
    for (let guard = 0; guard < 24; guard++) {
      ym = shiftYm(ym, 1)
      const date = `${ym}-${String(Math.min(day, daysIn(ym))).padStart(2, '0')}`
      if (date > today) break
      out.push({
        ...e,
        id: recurringId(series, ym),
        series,
        earnedOn: date,
        createdAt: `${date}T09:00:00.000Z`,
      })
    }
  }
  return out
}

// ── 엑셀로 받기 · 올리기 (2026-11-23) ──

/** 엑셀 머리줄 — 올리기에서도 이 모양을 그대로 읽는다 */
export const SIDE_SHEET_HEADER = ['날짜', '구분', '종류', '금액', '누가', '매달', '메모']

/** 기록 → 엑셀 줄 (날짜순) */
export function sideSheetRows(
  entries: SideIncome[],
  names: [string, string],
): (string | number)[][] {
  const rows = [...entries]
    .sort((a, b) =>
      a.earnedOn === b.earnedOn
        ? a.createdAt < b.createdAt
          ? -1
          : 1
        : a.earnedOn < b.earnedOn
          ? -1
          : 1,
    )
    .map((e) => [
      e.earnedOn,
      SIDE_KIND_LABEL[e.kind],
      e.category,
      e.amount,
      e.shared ? '공동' : names[e.memberNo - 1],
      e.repeat ? '매달' : '',
      e.note ?? '',
    ])
  return [SIDE_SHEET_HEADER, ...rows]
}

/** 이미 같은 기록이 있는지 — 받은 엑셀을 그대로 다시 올려도 두 번 들어가지 않게 */
export function isSameSideRow(r: PastedRow, e: SideIncome): boolean {
  const who = e.shared ? 'shared' : e.memberNo
  return (
    e.earnedOn === r.earnedOn &&
    e.kind === r.kind &&
    e.category === r.category &&
    e.amount === r.amount &&
    who === r.who
  )
}
