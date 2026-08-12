import { describe, expect, it } from 'vitest'
import { mergeOp, type PendingOp } from './syncQueue'
import type { MonthlyLedger, OccasionEntry } from '../types'

const ledger = (ym: string, amount: number): PendingOp => ({
  kind: 'ledger',
  key: `ledger:${ym}`,
  payload: {
    ym,
    items: [{ id: 'a', group: 'variable', category: '식비', member: 1, planned: 0, actual: amount }],
    closed: false,
  } as MonthlyLedger,
})

const occasion = (id: string): PendingOp => ({
  kind: 'occasion',
  key: `occasion:${id}`,
  payload: { id, date: '2026-08-01', category: '가족경조사', title: '축의금', amount: 100000 } as OccasionEntry,
})

const occasionDelete = (id: string): PendingOp => ({
  kind: 'occasionDelete',
  key: `occasionDelete:${id}`,
  payload: { id },
})

describe('mergeOp — 재시도 큐 병합', () => {
  it('새 key는 뒤에 추가된다', () => {
    const list = mergeOp([], ledger('2026-08', 100))
    expect(list).toHaveLength(1)
  })

  it('같은 달을 다시 저장하면 최신 것만 남는다', () => {
    // 오래된 상태를 나중에 replay 해서 최신 저장을 되돌리는 사고 방지
    let list = mergeOp([], ledger('2026-08', 100))
    list = mergeOp(list, ledger('2026-08', 999))
    expect(list).toHaveLength(1)
    expect((list[0].payload as MonthlyLedger).items[0].actual).toBe(999)
  })

  it('다른 달은 각각 남는다', () => {
    let list = mergeOp([], ledger('2026-08', 100))
    list = mergeOp(list, ledger('2026-09', 200))
    expect(list.map((o) => o.key)).toEqual(['ledger:2026-08', 'ledger:2026-09'])
  })

  it('교체해도 순서는 유지된다', () => {
    let list = mergeOp([], ledger('2026-08', 100))
    list = mergeOp(list, ledger('2026-09', 200))
    list = mergeOp(list, ledger('2026-08', 300))
    expect(list.map((o) => o.key)).toEqual(['ledger:2026-08', 'ledger:2026-09'])
  })

  it('아직 못 보낸 경조사를 지우면 둘 다 사라진다', () => {
    let list = mergeOp([], occasion('x1'))
    list = mergeOp(list, occasionDelete('x1'))
    expect(list).toEqual([])
  })

  it('아직 못 보낸 고백을 지우면 둘 다 사라진다', () => {
    const add: PendingOp = {
      kind: 'confession',
      key: 'confession:c1',
      payload: { id: 'c1' } as never,
    }
    const del: PendingOp = { kind: 'confessionDelete', key: 'confessionDelete:c1', payload: { id: 'c1' } }
    let list = mergeOp([], add)
    list = mergeOp(list, del)
    expect(list).toEqual([])
    // 이미 보낸 고백을 지우면 삭제 요청만 남는다
    expect(mergeOp([], del)).toEqual([del])
  })

  it('이미 보낸 경조사를 지우면 삭제 요청이 큐에 남는다', () => {
    const list = mergeOp([], occasionDelete('sent-1'))
    expect(list).toHaveLength(1)
    expect(list[0].kind).toBe('occasionDelete')
  })

  it('경조사 삭제가 다른 항목을 건드리지 않는다', () => {
    let list = mergeOp([], occasion('keep'))
    list = mergeOp(list, occasion('drop'))
    list = mergeOp(list, occasionDelete('drop'))
    expect(list.map((o) => o.key)).toEqual(['occasion:keep'])
  })

  it('프로필·카테고리는 종류당 한 건만 쌓인다', () => {
    const p = (n: string): PendingOp => ({
      kind: 'profile',
      key: 'profile',
      payload: { member1Name: n } as never,
    })
    let list = mergeOp([], p('남편'))
    list = mergeOp(list, p('신랑'))
    expect(list).toHaveLength(1)
    expect((list[0].payload as { member1Name: string }).member1Name).toBe('신랑')
  })

  it('고백은 id마다 따로 쌓인다 (덮어쓰지 않음)', () => {
    const c = (id: string): PendingOp => ({
      kind: 'confession',
      key: `confession:${id}`,
      payload: { id } as never,
    })
    let list = mergeOp([], c('c1'))
    list = mergeOp(list, c('c2'))
    expect(list).toHaveLength(2)
  })
})
