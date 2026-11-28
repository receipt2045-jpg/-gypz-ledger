import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import Assets from './Assets'
import { renderScreen, seedStore, TEST_YM } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'
import { shiftYm } from '../lib/format'

const navigate = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}))
beforeEach(() => navigate.mockReset())

const seed = () =>
  seedStore({
    snapshots: [
      {
        ym: TEST_YM,
        items: [
          {
            id: 'a1',
            kind: 'asset',
            group: 'realestate',
            name: '전세보증금',
            amount: 300_000_000,
            owner: '공동',
          },
          {
            id: 'a2',
            kind: 'asset',
            group: 'cash',
            name: '남편청약',
            amount: 6_500_000,
            owner: '남편',
          },
          {
            id: 'a3',
            kind: 'asset',
            group: 'consumable',
            name: '남편차',
            amount: 14_250_000,
            owner: '남편',
          },
          {
            id: 'a4',
            kind: 'asset',
            group: 'stock',
            name: '아내코인',
            amount: 4_100_000,
            owner: '아내',
          },
          {
            id: 'd1',
            kind: 'debt',
            group: 'cash',
            name: '남편신용',
            amount: 22_000_000,
            owner: '남편',
          },
        ],
      },
    ],
  })

describe('자산 탭 — 한 화면 (2026-10-05)', () => {
  it('함께: 전체 자산 기준, 종류는 쉬운 이름으로', () => {
    seed()
    renderScreen(<Assets />)
    expect(screen.getByText(/우리집 전체 자산/)).toBeInTheDocument()
    // 2026-10-21 원 그래프로 — 이름 옆 이모지 대신 색 점
    expect(screen.getByRole('img', { name: '자산 종류별 비율' })).toBeInTheDocument()
    expect(screen.getByText('집')).toBeInTheDocument()
    expect(screen.getByText('기타')).toBeInTheDocument()
    expect(screen.queryByText(/현금성|소비재|주식\/코인/)).not.toBeInTheDocument()
    expect(screen.getByText(/빼면 순자산/)).toBeInTheDocument()
    expect(screen.getByText(/모아불리 가계부 · 우리집/)).toBeInTheDocument()
  })

  it('자세히·차트·목표 카드는 없다', () => {
    seed()
    renderScreen(<Assets />)
    expect(screen.queryByRole('tab', { name: '자세히' })).not.toBeInTheDocument()
    expect(screen.queryByText('10년 목표 순자산')).not.toBeInTheDocument()
  })

  it('자산 로드맵 입구 — 설정에서 옮겨 왔다, 캡처 칸(기준 날짜 줄) 아래', () => {
    seed()
    renderScreen(<Assets />)
    const road = screen.getByRole('button', { name: /자산 로드맵/ })
    const stamp = screen.getByText(/모아불리 가계부 · 우리집 ·/)
    expect(stamp.compareDocumentPosition(road) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('남편을 고르면 남편 것만 엑셀처럼 표로', async () => {
    seed()
    const { user } = renderScreen(<Assets />)
    await user.click(screen.getByRole('button', { name: '남편' }))
    expect(screen.getByText('남편 자산표')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '비중' })).toBeInTheDocument()
    expect(screen.getByText('남편청약')).toBeInTheDocument()
    expect(screen.getByText('남편신용')).toBeInTheDocument()
    expect(screen.queryByText('아내코인')).not.toBeInTheDocument()
    // 순자산 = 650 + 1,425 − 2,200 = −125 (만원)
    expect(screen.getByText('−125')).toBeInTheDocument()
    expect(screen.getByText(/모아불리 가계부 · 남편/)).toBeInTheDocument()
  })

  it('자산이 없으면 등록 안내만', () => {
    seedStore({ snapshots: [] })
    renderScreen(<Assets />)
    expect(screen.getByText('아직 등록된 자산이 없어요')).toBeInTheDocument()
    expect(screen.queryByText(/우리집 전체 자산/)).not.toBeInTheDocument()
  })
})

describe('자산 탭 — 2026-11-17 의견', () => {
  it('자산 구성이 맨 위, 주식 일지·아이 통장은 그 아래', () => {
    seed()
    useLedgerStore.setState((s) => ({ profile: { ...s.profile, childNames: ['찰떡이'] } }))
    renderScreen(<Assets />)
    const total = screen.getByText(/우리집 전체 자산/)
    const stock = screen.getByText('주식 일지')
    expect(total.compareDocumentPosition(stock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('흐름 그래프에서 지난달을 누르면 지난달과 견준 표로 보고, 그 달 자산을 고치러 간다', async () => {
    seed()
    // 그다음 달에 전세보증금이 1억 늘었다
    const items = useLedgerStore.getState().snapshots[0].items
    useLedgerStore.setState({
      snapshots: [
        { ym: TEST_YM, items },
        {
          ym: shiftYm(TEST_YM, 1),
          items: items.map((it) => (it.id === 'a1' ? { ...it, amount: 400_000_000 } : it)),
        },
      ],
    })
    const { user } = renderScreen(<Assets />)
    expect(screen.getByText('점을 누르면 그 달 자산이 보여요')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '2026년 9월 자산 보기' }))
    expect(screen.getByText(/2026년 9월 전체 자산/)).toBeInTheDocument()
    // 홈 맨 위 순자산과 헷갈리지 않게 — 빚 빼기 전이라고 밝히고 순자산도 같이 (2026-11-19)
    expect(screen.getByText(/빚 빼기 전/)).toBeInTheDocument()
    expect(screen.getByText(/빚 빼면 순자산/)).toBeInTheDocument()
    // 3억 2,485만 → 4억 2,485만
    expect(screen.getByText('지난달보다 +1억')).toBeInTheDocument()
    // 표 — 종류별 금액과 지난달보다 (만원)
    const house = screen.getByRole('row', { name: /^집/ })
    expect(house).toHaveTextContent('40,000')
    expect(house).toHaveTextContent('+10,000')
    expect(screen.getByRole('row', { name: /^예적금/ })).toHaveTextContent('–')
    // 바뀐 항목
    expect(screen.getByText('지난달보다 바뀐 항목')).toBeInTheDocument()
    expect(screen.getByText('전세보증금')).toBeInTheDocument()
    expect(screen.getByText('+1억')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /9월 자산 고치기/ }))
    expect(navigate).toHaveBeenCalledWith('/asset-setup', { state: { ym: '2026-09' } })
  })

  it("빚이 줄면 −가 아니라 '갚음'으로 보여 준다 (2026-11-19)", async () => {
    seed()
    const items = useLedgerStore.getState().snapshots[0].items
    useLedgerStore.setState({
      snapshots: [
        { ym: TEST_YM, items },
        {
          ym: shiftYm(TEST_YM, 1),
          items: items.map((it) => (it.id === 'd1' ? { ...it, amount: 21_600_000 } : it)),
        },
      ],
    })
    const { user } = renderScreen(<Assets />)
    await user.click(screen.getByRole('button', { name: '2026년 9월 자산 보기' }))
    expect(screen.getByRole('row', { name: /^부채/ })).toHaveTextContent('40 갚음')
    expect(screen.getByText('40만 갚음')).toBeInTheDocument()
  })

  it('어디를 눌러도 고치러 간다 — 전체 자산 카드, 이름, 표의 줄', async () => {
    seed()
    const { user } = renderScreen(<Assets />)
    await user.click(screen.getByText(/우리집 전체 자산/))
    expect(navigate).toHaveBeenLastCalledWith('/asset-setup', { state: {} })
    await user.click(screen.getByRole('button', { name: '아내 자산 고치기' }))
    expect(navigate).toHaveBeenLastCalledWith('/asset-setup', { state: { owner: '아내' } })
    await user.click(screen.getByRole('button', { name: '남편' }))
    await user.click(screen.getByText('남편청약'))
    expect(navigate).toHaveBeenLastCalledWith('/asset-setup', {
      state: { owner: '남편', focusId: expect.any(String), focusName: '남편청약' },
    })
  })
})
