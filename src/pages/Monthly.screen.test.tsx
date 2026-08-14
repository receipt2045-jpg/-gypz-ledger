import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import Monthly from './Monthly'
import Yearly from './Yearly'
import { renderScreen, seedStore, TEST_YM } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'
import { shiftYm } from '../lib/format'

const savedOccasions = () => useLedgerStore.getState().occasions

function seedWithLedger() {
  seedStore({
    ledgers: [
      {
        ym: TEST_YM,
        closed: false,
        settledMembers: [],
        items: [
          { id: 'a', group: 'income', category: '주수입', member: 2, planned: 3_000_000, actual: 0 },
        ],
      },
    ],
  })
}

describe('가계부 탭 — 비정기 지출 기록', () => {
  it('가계부 탭에서 비정기 지출을 바로 추가할 수 있다', async () => {
    seedWithLedger()
    const { user } = renderScreen(<Monthly />)

    await user.click(screen.getByRole('button', { name: /추가/ }))
    await user.type(screen.getByPlaceholderText(/내용/), '친구 결혼식')
    await user.type(screen.getByPlaceholderText('금액'), '100000')
    await user.click(screen.getByRole('button', { name: '추가하기' }))

    expect(savedOccasions()).toHaveLength(1)
    expect(savedOccasions()[0]).toMatchObject({ title: '친구 결혼식', amount: 100_000 })
  })

  it("상단 '비정기 지출 입력' 버튼을 누르면 입력 폼이 열린다", async () => {
    seedWithLedger()
    const { user } = renderScreen(<Monthly />)

    expect(screen.queryByPlaceholderText(/내용/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /비정기 지출 입력/ }))
    expect(screen.getByPlaceholderText(/내용/)).toBeInTheDocument()
  })

  it('달을 옮긴 뒤 추가하면 보고 있는 그 달로 기록된다', async () => {
    seedWithLedger()
    const { user } = renderScreen(<Monthly />)

    await user.click(screen.getByRole('button', { name: '이전 달' }))
    await user.click(screen.getByRole('button', { name: /추가/ }))
    await user.type(screen.getByPlaceholderText(/내용/), '부모님 생신')
    await user.type(screen.getByPlaceholderText('금액'), '200000')
    await user.click(screen.getByRole('button', { name: '추가하기' }))

    // 폼 기본 날짜가 처음 열었던 달에 머물면, 엉뚱한 달로 저장되고
    // 보는 달 목록에서 사라져 "입력했는데 없어졌어요"가 된다
    const prevYm = shiftYm(TEST_YM, -1)
    expect(savedOccasions()).toHaveLength(1)
    expect(savedOccasions()[0].date.startsWith(prevYm)).toBe(true)
    expect(screen.getByText('부모님 생신')).toBeInTheDocument()
  })

  it('보는 달의 비정기 지출만 목록에 보인다', () => {
    seedWithLedger()
    useLedgerStore.setState({
      occasions: [
        { id: 'o1', date: `${TEST_YM}-10`, category: '가족경조사', title: '어머니 생신', amount: 200_000 },
        { id: 'o2', date: '2026-03-05', category: '세금', title: '자동차세', amount: 150_000 },
      ],
    })
    renderScreen(<Monthly />)

    expect(screen.getByText('어머니 생신')).toBeInTheDocument()
    expect(screen.queryByText('자동차세')).not.toBeInTheDocument()
  })

  it("다른 달 기록은 '올해 전체 보기'로 꺼내서 지울 수 있다", async () => {
    // 실제 신고 상황: 일년치를 몰아 적으면 합계만 뜨고 내역이 안 보였다
    seedWithLedger()
    useLedgerStore.setState({
      occasions: [
        { id: 'o2', date: '2026-03-05', category: '세금', title: '자동차세', amount: 150_000 },
      ],
    })
    const { user } = renderScreen(<Monthly />)

    expect(screen.queryByText('자동차세')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /올해 전체 보기/ }))
    expect(screen.getByText('자동차세')).toBeInTheDocument()

    await user.click(screen.getByLabelText('삭제'))
    expect(savedOccasions()).toHaveLength(0)
  })
})

describe('가계부 탭 — 정산 취소', () => {
  const seedSettled = (settledMembers: (1 | 2)[], closed: boolean) =>
    seedStore({
      memberNo: 2,
      ledgers: [
        {
          ym: TEST_YM,
          closed,
          settledMembers,
          items: [
            { id: 'a', group: 'income', category: '주수입', member: 2, planned: 3_000_000, actual: 3_000_000 },
          ],
        },
      ],
    })

  it('혼자만 정산한 경우에도 취소 버튼이 보인다', () => {
    // 예전엔 부부 둘 다 끝낸 달(closed)에만 보여서 되돌릴 방법이 없었다
    seedSettled([2], false)
    renderScreen(<Monthly />)
    expect(screen.getByRole('button', { name: /정산 취소하기/ })).toBeInTheDocument()
  })

  it('정산을 안 했으면 취소 버튼이 없다', () => {
    seedSettled([], false)
    renderScreen(<Monthly />)
    expect(screen.queryByRole('button', { name: /정산 취소하기/ })).not.toBeInTheDocument()
  })

  it('취소하면 내 정산만 풀리고 배우자 것은 남는다', async () => {
    seedSettled([1, 2], true)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user } = renderScreen(<Monthly />)

    // 부부 둘 다 끝낸 달은 화면이 다음 달로 넘어가 있다 — 그 달로 돌아가야 보인다
    await user.click(screen.getByRole('button', { name: '이전 달' }))
    await user.click(screen.getByRole('button', { name: /정산 취소하기/ }))

    const saved = useLedgerStore.getState().ledgers.find((l) => l.ym === TEST_YM)
    expect(saved?.closed).toBe(false)
    expect(saved?.settledMembers).toEqual([1])
    // 입력한 기록은 그대로
    expect(saved?.items).toHaveLength(1)
  })
})

describe('가계부 탭 — 한 달 통째로 지우기', () => {
  const seedTwoMonths = () =>
    seedStore({
      ledgers: [
        {
          ym: shiftYm(TEST_YM, -1),
          closed: false,
          settledMembers: [],
          items: [
            { id: 'p', group: 'income', category: '주수입', member: 2, planned: 1_000_000, actual: 0 },
          ],
        },
        {
          ym: TEST_YM,
          closed: false,
          settledMembers: [],
          items: [
            { id: 'a', group: 'income', category: '주수입', member: 2, planned: 3_000_000, actual: 0 },
          ],
        },
      ],
      snapshots: [
        { ym: TEST_YM, items: [{ id: 's1', kind: 'asset', group: 'cash', name: '통장', amount: 1_000 }] },
      ],
    })

  it('그 달의 가계부와 자산이 함께 지워진다', async () => {
    seedTwoMonths()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user } = renderScreen(<Monthly />)

    await user.click(screen.getByRole('button', { name: /기록 통째로 지우기/ }))

    const s = useLedgerStore.getState()
    expect(s.ledgers.map((l) => l.ym)).toEqual([shiftYm(TEST_YM, -1)])
    expect(s.snapshots).toHaveLength(0)
  })

  it('확인창에서 취소하면 아무것도 안 지워진다', async () => {
    seedTwoMonths()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { user } = renderScreen(<Monthly />)

    await user.click(screen.getByRole('button', { name: /기록 통째로 지우기/ }))

    expect(useLedgerStore.getState().ledgers).toHaveLength(2)
  })

  it('저장된 기록이 없는 달에는 버튼이 없다', async () => {
    seedTwoMonths()
    const { user } = renderScreen(<Monthly />)

    // 다음 달은 이전 달에서 만들어 보여줄 뿐, 저장된 기록은 없다
    await user.click(screen.getByRole('button', { name: '다음 달' }))
    expect(screen.queryByRole('button', { name: /기록 통째로 지우기/ })).not.toBeInTheDocument()
  })
})

describe('가계부 탭 — 고백 내역 삭제', () => {
  const seedConfessions = () =>
    seedStore({
      memberNo: 2,
      confessions: [
        {
          id: 'c1',
          memberNo: 2,
          category: '식비',
          kind: 'variable',
          amount: 9_000,
          createdAt: `${TEST_YM}-10T12:00:00.000Z`,
        },
        {
          id: 'c2',
          memberNo: 1,
          category: '카페/간식',
          kind: 'variable',
          amount: 5_500,
          createdAt: `${TEST_YM}-11T12:00:00.000Z`,
        },
      ],
    })

  it('내가 쓴 고백만 지울 수 있다 (배우자 것엔 삭제 버튼이 없다)', async () => {
    seedConfessions()
    const { user } = renderScreen(<Monthly />)

    await user.click(screen.getByRole('button', { name: /이번 달 고백/ }))
    // 내 것(c1) 하나에만 삭제 버튼
    expect(screen.getAllByLabelText('고백 삭제')).toHaveLength(1)

    await user.click(screen.getByLabelText('고백 삭제'))
    const left = useLedgerStore.getState().confessions
    expect(left.map((c) => c.id)).toEqual(['c2'])
  })

  it('데이터 초기화는 고백까지 지운다', () => {
    seedConfessions()
    useLedgerStore.getState().resetData()
    expect(useLedgerStore.getState().confessions).toEqual([])
  })
})

describe('연간 리포트 — 조회 전용 + 연말정산 입구', () => {
  it('연간 리포트엔 비정기 지출 추가 버튼이 없다 (기록은 가계부 탭)', () => {
    seedStore({})
    renderScreen(<Yearly />)
    expect(screen.getByText('비정기 지출')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /추가/ })).not.toBeInTheDocument()
  })

  it('연말정산 미리보기 입구가 연간 리포트 상단에 있다', () => {
    seedStore({})
    renderScreen(<Yearly />)
    expect(screen.getByText(/누구 카드로 쓸까/)).toBeInTheDocument()
  })
})
