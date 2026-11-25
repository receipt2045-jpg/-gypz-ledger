import { describe, expect, it } from 'vitest'
import {
  QUEUE_KEY,
  dropQueued,
  enqueue,
  flushQueue,
  mergeOp,
  pendingCount,
  type PendingOp,
} from './syncQueue'
import type { MonthlyLedger, OccasionEntry } from '../types'

const ledger = (ym: string, amount: number): PendingOp => ({
  kind: 'ledger',
  key: `ledger:${ym}`,
  payload: {
    ym,
    items: [
      { id: 'a', group: 'variable', category: '식비', member: 1, planned: 0, actual: amount },
    ],
    closed: false,
  } as MonthlyLedger,
})

const occasion = (id: string): PendingOp => ({
  kind: 'occasion',
  key: `occasion:${id}`,
  payload: {
    id,
    date: '2026-08-01',
    category: '가족경조사',
    title: '축의금',
    amount: 100000,
  } as OccasionEntry,
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
    const del: PendingOp = {
      kind: 'confessionDelete',
      key: 'confessionDelete:c1',
      payload: { id: 'c1' },
    }
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

describe('dropQueued — 바로 보내기에 성공하면 옛 실패분을 버린다 (2026-11-17)', () => {
  it('같은 key만 지우고 나머지는 남긴다', () => {
    localStorage.removeItem(QUEUE_KEY)
    const ledgerOp = (ym: string): PendingOp => ({
      kind: 'ledger',
      key: `ledger:${ym}`,
      payload: { ym, items: [], closed: false },
    })
    enqueue(ledgerOp('2026-10'))
    enqueue(ledgerOp('2026-11'))
    dropQueued('ledger:2026-11')
    expect(pendingCount()).toBe(1)
    dropQueued('ledger:2026-10')
    expect(pendingCount()).toBe(0)
  })
})

describe('flushQueue — 보내는 사이 바뀐 큐를 덮어쓰지 않는다 (2026-11-19 점검)', () => {
  it('보내는 사이 바로 저장에 성공해 지운 옛 실패분이 되살아나지 않는다', async () => {
    localStorage.removeItem(QUEUE_KEY)
    enqueue(ledger('2026-10', 100))
    enqueue(ledger('2026-11', 200))
    const sent: string[] = []
    await flushQueue('h1', async (op) => {
      sent.push(op.key)
      // 첫 건을 보내는 사이 사용자가 11월을 다시 저장했고 바로 성공했다
      if (op.key === 'ledger:2026-10') dropQueued('ledger:2026-11')
    })
    expect(sent).toEqual(['ledger:2026-10'])
    expect(pendingCount()).toBe(0)
  })

  it('보내는 사이 새로 실패해 넣은 저장은 남는다', async () => {
    localStorage.removeItem(QUEUE_KEY)
    enqueue(ledger('2026-10', 100))
    let first = true
    const left = await flushQueue('h1', async () => {
      if (first) {
        first = false
        enqueue(ledger('2026-11', 300))
        return
      }
      throw new Error('offline')
    })
    expect(left).toBe(1)
    expect(JSON.parse(localStorage.getItem(QUEUE_KEY)!)[0].key).toBe('ledger:2026-11')
  })

  it('보내는 사이 같은 달이 더 새 내용으로 바뀌면 새 내용을 한 번 더 보낸다', async () => {
    localStorage.removeItem(QUEUE_KEY)
    enqueue(ledger('2026-10', 100))
    const amounts: number[] = []
    await flushQueue('h1', async (op) => {
      const amt = (op.payload as MonthlyLedger).items[0].actual
      amounts.push(amt)
      if (amt === 100) enqueue(ledger('2026-10', 999))
    })
    expect(amounts).toEqual([100, 999])
    expect(pendingCount()).toBe(0)
  })
})
