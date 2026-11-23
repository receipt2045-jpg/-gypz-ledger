// 우리집 메모 저장소 (2026-11-24) — supabase/memos.sql.
// 로그인 전 둘러보기(예시 가계부)에선 householdId가 없어서 같은 모양의 메모리 저장소를 쓴다.
import { supabase } from './supabase'

export interface Memo {
  id: string
  memberNo: 1 | 2
  body: string
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export interface MemoApi {
  load(): Promise<Memo[]>
  add(body: string, memberNo: 1 | 2): Promise<void>
  update(id: string, patch: Partial<Pick<Memo, 'body' | 'pinned'>>): Promise<void>
  remove(id: string): Promise<void>
}

export const MEMO_MAX = 2000

const toMemo = (r: any): Memo => ({
  id: r.id,
  memberNo: r.member_no,
  body: r.body,
  pinned: r.pinned === true,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export function remoteMemo(householdId: string): MemoApi {
  return {
    async load() {
      const { data, error } = await supabase
        .from('memos')
        .select('*')
        .eq('household_id', householdId)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map(toMemo)
    },
    async add(body, memberNo) {
      const { error } = await supabase
        .from('memos')
        .insert({ household_id: householdId, member_no: memberNo, body: body.trim() })
      if (error) throw error
    },
    async update(id, patch) {
      const { error } = await supabase
        .from('memos')
        .update({
          ...(patch.body !== undefined ? { body: patch.body.trim() } : {}),
          ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) throw error
    },
    async remove(id) {
      const { error } = await supabase.from('memos').delete().eq('id', id)
      if (error) throw error
    },
  }
}

export function localMemo(seed: Memo[]): MemoApi {
  let memos = [...seed]
  return {
    async load() {
      return [...memos]
    },
    async add(body, memberNo) {
      const now = new Date().toISOString()
      memos = [
        {
          id: crypto.randomUUID(),
          memberNo,
          body: body.trim(),
          pinned: false,
          createdAt: now,
          updatedAt: now,
        },
        ...memos,
      ]
    },
    async update(id, patch) {
      const now = new Date().toISOString()
      memos = memos.map((m) =>
        m.id === id
          ? {
              ...m,
              ...patch,
              ...(patch.body !== undefined ? { body: patch.body.trim() } : {}),
              updatedAt: now,
            }
          : m,
      )
    },
    async remove(id) {
      memos = memos.filter((m) => m.id !== id)
    },
  }
}

/** 둘러보기 예시 */
export function sampleMemos(now: Date = new Date()): Memo[] {
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString()
  return [
    {
      id: 'sample-memo-1',
      memberNo: 2,
      body: '12월 고정비 다시 보기\n- 통신비 알뜰폰으로 바꾸면 월 3만 원 아낌\n- 넷플릭스·쿠팡 구독 하나만 남기기',
      pinned: true,
      createdAt: at(6),
      updatedAt: at(2),
    },
    {
      id: 'sample-memo-2',
      memberNo: 1,
      body: '자동차 보험 갱신 1월 15일 — 다이렉트로 비교해 보기',
      pinned: false,
      createdAt: at(4),
      updatedAt: at(4),
    },
  ]
}

/** 줄 순서 — 고정한 메모 먼저, 그다음 최근에 고친 순 */
export function sortMemos(list: Memo[]): Memo[] {
  return [...list].sort((a, b) =>
    a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : a.updatedAt < b.updatedAt ? 1 : -1,
  )
}
