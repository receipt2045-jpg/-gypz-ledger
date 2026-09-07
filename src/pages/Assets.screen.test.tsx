import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import Assets from './Assets'
import { renderScreen, seedStore, TEST_YM } from '../test/renderScreen'

describe('자산 탭 — 목적지 먼저', () => {
  it('10년 목표 순자산이 순자산 요약보다 위에 있다', () => {
    seedStore({
      snapshots: [
        {
          ym: TEST_YM,
          items: [
            { id: 'a', kind: 'asset', group: 'cash', name: '주거래', amount: 10_000_000, owner: '아내' },
          ],
        },
      ],
    })
    renderScreen(<Assets />)

    const goal = screen.getByText('10년 목표 순자산')
    const summary = screen.getByText('순자산', { selector: 'p' })
    // DOM 순서: 목표 카드가 요약 카드보다 앞
    expect(
      goal.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

describe('자산 탭 — 사람별로 보기', () => {
  const seedCouple = () =>
    seedStore({
      snapshots: [
        {
          ym: TEST_YM,
          items: [
            { id: 'a1', kind: 'asset', group: 'cash', name: '남편비상금', amount: 15_000_000, owner: '남편' },
            { id: 'a2', kind: 'asset', group: 'stock', name: '남편주식', amount: 30_000_000, owner: '남편' },
            { id: 'a3', kind: 'asset', group: 'cash', name: '아내청약', amount: 5_000_000, owner: '아내' },
            { id: 'd1', kind: 'debt', group: 'realestate', name: '남편주담대', amount: 40_000_000, owner: '남편' },
            { id: 'd2', kind: 'debt', group: 'realestate', name: '아내대출', amount: 70_000_000, owner: '아내' },
          ],
        },
      ],
    })

  it('남편 탭을 누르면 남편 것만 종류별로 보인다', async () => {
    seedCouple()
    const { user } = renderScreen(<Assets />)

    // 함께 보기에서는 둘 다 보인다
    expect(screen.getByText('아내청약')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '남편' }))

    expect(screen.getByText('남편비상금')).toBeInTheDocument()
    expect(screen.getByText('남편주식')).toBeInTheDocument()
    expect(screen.queryByText('아내청약')).not.toBeInTheDocument()
    // 자산 종류 구분은 그대로 유지.
    // 그룹 이름은 구성 막대 범례에도 뜨므로 섹션 제목(h3)으로 콕 집는다.
    expect(screen.getByRole('heading', { name: /현금성/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /주식\/코인/ })).toBeInTheDocument()
  })

  it('사람을 고르면 그 사람 순자산(자산 − 부채)이 나온다', async () => {
    seedCouple()
    const { user } = renderScreen(<Assets />)
    await user.click(screen.getByRole('button', { name: '남편' }))

    // 자산 4,500만 − 부채 4,000만 = 순자산 500만
    expect(screen.getByText('500만원')).toBeInTheDocument()
    expect(screen.getByText(/자산 4,500만원/)).toBeInTheDocument()
    // 부채 섹션 합계도 그 사람 것만 — 부부 전체(1억 1,000만)가 뜨면 안 된다
    expect(screen.getAllByText('−4,000만원').length).toBeGreaterThan(0)
    expect(screen.queryByText(/1억 1,000만원/)).not.toBeInTheDocument()
  })

  it('함께로 돌아오면 10년 목표 카드가 다시 보인다', async () => {
    seedCouple()
    const { user } = renderScreen(<Assets />)

    await user.click(screen.getByRole('button', { name: '남편' }))
    expect(screen.queryByText('10년 목표 순자산')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '함께' }))
    expect(screen.getByText('10년 목표 순자산')).toBeInTheDocument()
  })
})

describe('자산 탭 — 자산 구성 비율', () => {
  const seedMixed = () =>
    seedStore({
      snapshots: [
        {
          ym: TEST_YM,
          items: [
            { id: 'a1', kind: 'asset', group: 'cash', name: '통장', amount: 31_000_000 },
            { id: 'a2', kind: 'asset', group: 'pension', name: '연금', amount: 6_000_000 },
            { id: 'a3', kind: 'asset', group: 'stock', name: '주식', amount: 10_500_000 },
            { id: 'a4', kind: 'asset', group: 'realestate', name: '집', amount: 2_500_000 },
          ],
        },
      ],
    })

  it('막대와 비율, 두 덩어리 소제목이 함께 나온다', () => {
    seedMixed()
    renderScreen(<Assets />)

    expect(screen.getByText('자산 구성')).toBeInTheDocument()
    expect(screen.getByText('모으는 돈')).toBeInTheDocument()
    expect(screen.getByText('불리는 돈')).toBeInTheDocument()
    expect(screen.getByText('62%')).toBeInTheDocument()
  })

  it('도넛 카드는 역할이 달라 이름을 나눠 갖는다', () => {
    seedMixed()
    renderScreen(<Assets />)
    // 예전엔 도넛도 '자산 구성'이라 같은 이름이 두 번 떴다
    expect(screen.getByText('순자산과 부채')).toBeInTheDocument()
    expect(screen.getAllByText('자산 구성')).toHaveLength(1)
  })

  it('소비재는 기타로 묶여서 나온다', () => {
    seedStore({
      snapshots: [
        {
          ym: TEST_YM,
          items: [
            { id: 'a1', kind: 'asset', group: 'cash', name: '통장', amount: 50_000_000 },
            { id: 'a2', kind: 'asset', group: 'stock', name: '주식', amount: 30_000_000 },
            { id: 'a3', kind: 'asset', group: 'consumable', name: '자동차', amount: 20_000_000 },
          ],
        },
      ],
    })
    renderScreen(<Assets />)
    expect(screen.getByText('기타')).toBeInTheDocument()
  })

  // 한 종류만 있으면 '비율'이랄 게 없다 — 100%짜리 막대 하나는 정보가 아니다
  it('자산이 한 종류뿐이면 아예 안 나온다', () => {
    seedStore({
      snapshots: [
        {
          ym: TEST_YM,
          items: [{ id: 'a1', kind: 'asset', group: 'cash', name: '통장', amount: 10_000_000 }],
        },
      ],
    })
    renderScreen(<Assets />)
    expect(screen.queryByText('모으는 돈')).not.toBeInTheDocument()
  })
})
