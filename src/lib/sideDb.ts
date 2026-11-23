// 부수입 저장소 (2026-11-19) — supabase/side-income.sql 표 두 개.
// 로그인 전 둘러보기(예시 가계부)에선 householdId가 없어서, 같은 모양의 메모리 저장소를 쓴다.
import { supabase } from './supabase'
import { shiftYm } from './format'
import type { SideAllocation, SideIncome, SideSettlement } from './sideIncome'

export type NewSideIncome = Omit<SideIncome, 'id' | 'createdAt'>

export interface SideApi {
  load(): Promise<{ entries: SideIncome[]; settles: SideSettlement[] }>
  add(n: NewSideIncome): Promise<SideIncome>
  /** 매달 기록을 정해진 id로 넣는다 — 이미 있으면 건너뛴다 */
  addMany(rows: SideIncome[]): Promise<void>
  update(id: string, patch: Partial<NewSideIncome>): Promise<void>
  remove(id: string): Promise<void>
  settle(ym: string, allocations: SideAllocation[]): Promise<void>
  unsettle(ym: string): Promise<void>
}

const nz = (s: string | undefined) => (s && s.trim() ? s.trim() : null)

function toEntry(r: any): SideIncome {
  return {
    id: r.id,
    memberNo: r.member_no,
    shared: r.shared === true ? true : undefined,
    kind: r.kind,
    category: r.category,
    amount: Number(r.amount),
    price: r.price == null ? undefined : Number(r.price),
    paid: r.paid == null ? undefined : Number(r.paid),
    note: r.note ?? undefined,
    earnedOn: r.earned_on,
    createdAt: r.created_at,
    repeat: r.repeat === true ? true : undefined,
    series: r.series ?? undefined,
  }
}

function toRow(n: Partial<NewSideIncome>) {
  const row: Record<string, unknown> = {}
  if (n.memberNo !== undefined) row.member_no = n.memberNo
  if ('shared' in n) row.shared = n.shared === true
  if (n.kind !== undefined) row.kind = n.kind
  if (n.category !== undefined) row.category = n.category.trim()
  if (n.amount !== undefined) row.amount = n.amount
  if ('price' in n) row.price = n.price ?? null
  if ('paid' in n) row.paid = n.paid ?? null
  if ('note' in n) row.note = nz(n.note)
  if (n.earnedOn !== undefined) row.earned_on = n.earnedOn
  if ('repeat' in n) row.repeat = n.repeat === true
  if ('series' in n) row.series = n.series ?? null
  return row
}

export function remoteSide(householdId: string): SideApi {
  return {
    async load() {
      const [e, s] = await Promise.all([
        supabase
          .from('side_incomes')
          .select('*')
          .eq('household_id', householdId)
          .order('earned_on', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.from('side_settlements').select('*').eq('household_id', householdId),
      ])
      if (e.error) throw e.error
      if (s.error) throw s.error
      return {
        entries: (e.data ?? []).map(toEntry),
        settles: (s.data ?? []).map((r) => ({
          ym: r.ym,
          allocations: (r.allocations ?? []) as SideAllocation[],
          closedAt: r.closed_at,
        })),
      }
    },
    async add(n) {
      const { data, error } = await supabase
        .from('side_incomes')
        .insert({ household_id: householdId, ...toRow(n) })
        .select('*')
        .single()
      if (error) throw error
      return toEntry(data)
    },
    async addMany(rows) {
      if (rows.length === 0) return
      const { error } = await supabase.from('side_incomes').upsert(
        rows.map((r) => ({ id: r.id, household_id: householdId, ...toRow(r) })),
        { onConflict: 'id', ignoreDuplicates: true },
      )
      if (error) throw error
    },
    async update(id, patch) {
      const { error } = await supabase.from('side_incomes').update(toRow(patch)).eq('id', id)
      if (error) throw error
    },
    async remove(id) {
      const { error } = await supabase.from('side_incomes').delete().eq('id', id)
      if (error) throw error
    },
    async settle(ym, allocations) {
      const { error } = await supabase.from('side_settlements').upsert({
        household_id: householdId,
        ym,
        allocations,
        closed_at: new Date().toISOString(),
      })
      if (error) throw error
    },
    async unsettle(ym) {
      const { error } = await supabase
        .from('side_settlements')
        .delete()
        .eq('household_id', householdId)
        .eq('ym', ym)
      if (error) throw error
    },
  }
}

export function localSide(seed: { entries: SideIncome[]; settles: SideSettlement[] }): SideApi {
  let entries = [...seed.entries]
  let settles = [...seed.settles]
  return {
    async load() {
      return { entries: [...entries], settles: [...settles] }
    },
    async add(n) {
      const e: SideIncome = { ...n, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
      entries = [e, ...entries]
      return e
    },
    async addMany(rows) {
      const have = new Set(entries.map((e) => e.id))
      entries = [...rows.filter((r) => !have.has(r.id)), ...entries]
    },
    async update(id, patch) {
      entries = entries.map((e) => (e.id === id ? { ...e, ...patch } : e))
    },
    async remove(id) {
      entries = entries.filter((e) => e.id !== id)
    },
    async settle(ym, allocations) {
      settles = [
        ...settles.filter((s) => s.ym !== ym),
        { ym, allocations, closedAt: new Date().toISOString() },
      ]
    },
    async unsettle(ym) {
      settles = settles.filter((s) => s.ym !== ym)
    },
  }
}

/** 둘러보기 예시 — 이번 달과 지난달 */
export function sampleSide(now: Date = new Date()): {
  entries: SideIncome[]
  settles: SideSettlement[]
} {
  const ym = now.toLocaleDateString('sv-SE').slice(0, 7)
  const prev = shiftYm(ym, -1)
  const day = (m: string, d: number) => `${m}-${String(d).padStart(2, '0')}`
  const today = Math.max(1, Math.min(now.getDate(), 28))
  const d = (n: number) => day(ym, Math.min(n, today))
  let i = 0
  const e = (x: Omit<SideIncome, 'id' | 'createdAt'>): SideIncome => ({
    ...x,
    id: `sample-side-${++i}`,
    createdAt: `${x.earnedOn}T12:00:00.000Z`,
  })
  return {
    entries: [
      e({
        memberNo: 2,
        kind: 'cash',
        category: '원고료',
        amount: 150_000,
        note: '블로그 원고',
        earnedOn: d(12),
      }),
      e({
        memberNo: 1,
        kind: 'cash',
        category: '앱테크',
        amount: 32_000,
        note: '캐시워크 출금',
        earnedOn: d(9),
      }),
      e({
        memberNo: 1,
        kind: 'cash',
        category: '기프티콘 판매',
        amount: 28_000,
        note: '배민 상품권',
        earnedOn: d(5),
      }),
      e({
        memberNo: 2,
        kind: 'saved',
        category: '체험단',
        amount: 50_000,
        price: 60_000,
        paid: 10_000,
        note: '성수 파스타',
        earnedOn: d(14),
      }),
      e({
        memberNo: 2,
        kind: 'saved',
        category: '협찬 제품',
        amount: 130_000,
        price: 130_000,
        note: '청소기',
        earnedOn: d(7),
      }),
      e({
        memberNo: 1,
        kind: 'saved',
        category: '기프티콘 사용',
        amount: 53_000,
        note: '커피·치킨',
        earnedOn: d(3),
      }),
      e({
        memberNo: 1,
        shared: true,
        kind: 'saved',
        category: '포인트 결제',
        amount: 30_000,
        note: '마트 포인트',
        earnedOn: d(2),
      }),
      e({
        memberNo: 2,
        kind: 'cash',
        category: '중고 판매',
        amount: 80_000,
        note: '아기 옷',
        earnedOn: day(prev, 20),
      }),
      e({ memberNo: 1, kind: 'cash', category: '앱테크', amount: 41_000, earnedOn: day(prev, 11) }),
      e({
        memberNo: 2,
        kind: 'saved',
        category: '체험단',
        amount: 90_000,
        price: 90_000,
        note: '호텔 뷔페',
        earnedOn: day(prev, 8),
      }),
    ],
    settles: [
      {
        ym: prev,
        allocations: [
          { to: 'asset', assetId: 'sample', assetName: '토스증권 주식', amount: 121_000 },
        ],
        closedAt: `${day(prev, 28)}T12:00:00.000Z`,
      },
    ],
  }
}
