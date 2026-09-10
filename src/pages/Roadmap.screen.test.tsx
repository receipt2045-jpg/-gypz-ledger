import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import Roadmap from './Roadmap'
import { renderScreen, seedStore, TEST_YM } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'
import { currentYm, shiftYm } from '../lib/format'
import type { BudgetItem } from '../types'

const 만 = 10_000
const item = (
  id: string,
  group: BudgetItem['group'],
  category: string,
  member: 1 | 2,
  amount: number,
): BudgetItem => ({ id, group, category, member, planned: amount, actual: amount })

/** 목업 숫자: 소득 600(남편 250·아내 350) · 저축 330 · 부수입 30 · 자산 3,100만 */
function seedCouple(goal?: { amount: number; targetYm: string; name?: string }) {
  seedStore({
    ledgers: [
      {
        ym: TEST_YM,
        closed: false,
        settledMembers: [],
        items: [
          item('i1', 'income', '주수입', 1, 250 * 만),
          item('i2', 'income', '주수입', 2, 320 * 만),
          item('i3', 'income', '부수입', 2, 30 * 만),
          item('s1', 'saving', '적금', 1, 200 * 만),
          item('s2', 'investment', '주식', 2, 130 * 만),
        ],
      },
    ],
    snapshots: [
      {
        ym: TEST_YM,
        items: [
          { id: 'a1', kind: 'asset', group: 'cash', name: '통장', amount: 2_500 * 만 },
          { id: 'a2', kind: 'asset', group: 'stock', name: '주식', amount: 600 * 만 },
        ],
      },
    ],
  })
  if (goal) {
    const p = useLedgerStore.getState().profile
    useLedgerStore.setState({ profile: { ...p, goal } })
  }
}

// 목표 달은 '오늘'을 기준으로 30달 뒤 — 어느 달에 돌려도 같은 숫자가 나온다
const TARGET = shiftYm(currentYm(), 30)

describe('자산 로드맵 — 목표 넣기 전', () => {
  it('지금 속도와 입력 칸이 보이고, 상태 배지는 아직 없다', () => {
    seedCouple()
    renderScreen(<Roadmap />)

    expect(screen.getByText('지금 속도')).toBeInTheDocument()
    // (330 + 30) × 12 = 4,320만
    expect(screen.getByText(/1년에 4,320만/)).toBeInTheDocument()
    expect(screen.getByText('얼마를 언제까지 모을까요?')).toBeInTheDocument()
    expect(screen.queryByText('조금 모자라요')).not.toBeInTheDocument()
  })

  it('정산이 없으면 정산부터 하라고 한다', () => {
    seedStore({})
    renderScreen(<Roadmap />)
    expect(screen.getByText(/먼저 이번 달 정산을/)).toBeInTheDocument()
  })

  it('금액·시점을 넣고 만들면 목표가 저장된다', async () => {
    seedCouple()
    const { user } = renderScreen(<Roadmap />)

    await user.click(screen.getByRole('button', { name: '로드맵 만들기' }))

    const saved = useLedgerStore.getState().profile.goal
    expect(saved?.amount).toBe(100_000_000) // 기본값 1억
    expect(saved?.targetYm).toBe(shiftYm(currentYm(), 36)) // 기본값 3년 뒤
    expect(saved?.createdYm).toBe(currentYm())
    // 화면이 목표 넣은 뒤로 바뀐다
    expect(screen.getByText('모을 돈')).toBeInTheDocument()
  })
})

describe('자산 로드맵 — 목표 넣은 뒤 (목업 숫자)', () => {
  it('상태·D-day·모자란 돈·지렛대 둘이 목업대로 나온다', () => {
    seedCouple({ amount: 18_000 * 만, targetYm: TARGET })
    renderScreen(<Roadmap />)

    expect(screen.getByText('조금 모자라요')).toBeInTheDocument()
    expect(screen.getByText('D-30개월')).toBeInTheDocument()
    // ③ 카드와 연도별 마지막 막대에 같이 뜬다 — 둘 다 같은 숫자여야 한다
    expect(screen.getAllByText(/1억 3,900만/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/4,100만.*모자라요/)).toBeInTheDocument()
    // 지렛대: 월 +137만 또는 12개월 (12개월은 ① "12개월 늦어요"에도 뜬다 → 둘 다 같은 수여야)
    expect(screen.getByText('+137만원')).toBeInTheDocument()
    expect(screen.getAllByText('12개월').length).toBeGreaterThanOrEqual(2)
  })

  it('진행률은 자산 전체 기준이다 — 현금만이 아니라 주식까지', () => {
    seedCouple({ amount: 18_000 * 만, targetYm: TARGET })
    renderScreen(<Roadmap />)
    // 2,500 + 600 = 3,100만 → 17% (② 카드와 연도별 '지금' 막대 양쪽에 뜬다)
    expect(screen.getAllByText(/3,100만/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/\(17%\)/)).toBeInTheDocument()
  })

  it('지렛대는 버튼이 아니다 — 눌러서 목표가 바뀌면 안 된다', () => {
    seedCouple({ amount: 18_000 * 만, targetYm: TARGET })
    renderScreen(<Roadmap />)
    expect(screen.queryByRole('button', { name: /12개월/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /137만/ })).not.toBeInTheDocument()
  })

  it('충분히 모으면 잘 가고 있어요', () => {
    seedCouple({ amount: 1_000 * 만, targetYm: TARGET })
    renderScreen(<Roadmap />)
    expect(screen.getByText('잘 가고 있어요')).toBeInTheDocument()
    expect(screen.queryByText(/모자라요/)).not.toBeInTheDocument()
  })

  it('만약에 — 소득이 있는 사람마다 한 줄', () => {
    seedCouple({ amount: 18_000 * 만, targetYm: TARGET })
    renderScreen(<Roadmap />)
    expect(screen.getByText('만약에')).toBeInTheDocument()
    // 이름이 <b>로 감싸여 있어 한 줄 전체 텍스트로 본다
    const lines = screen
      .getAllByText(/소득이 멈추면/, { selector: 'p' })
      .map((p) => p.textContent ?? '')
    expect(lines.some((t) => t.startsWith('남편'))).toBe(true)
    expect(lines.some((t) => t.startsWith('아내'))).toBe(true)
  })

  it('고치기를 누르면 입력 화면으로, 그대로 두기로 돌아온다', async () => {
    seedCouple({ amount: 18_000 * 만, targetYm: TARGET, name: '첫 1억 8천' })
    const { user } = renderScreen(<Roadmap />)

    await user.click(screen.getByRole('button', { name: '목표 고치기' }))
    expect(screen.getByText('목표 고치기', { selector: 'p' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '그대로 두기' }))
    expect(screen.getByText(/모을 돈 · 첫 1억 8천/)).toBeInTheDocument()
  })

  it('역할·이유를 적으면 목표에 같이 저장된다', async () => {
    seedCouple({ amount: 18_000 * 만, targetYm: TARGET })
    const { user } = renderScreen(<Roadmap />)

    const reason = screen.getByPlaceholderText('한 줄로')
    await user.type(reason, '아이 학교 옮기지 않기')
    await user.tab() // blur → 저장

    expect(useLedgerStore.getState().profile.goal?.reason).toBe('아이 학교 옮기지 않기')
  })

  it('우리 팀 상태는 접혀서 맨 아래에 있다', async () => {
    seedCouple({ amount: 18_000 * 만, targetYm: TARGET })
    const { user } = renderScreen(<Roadmap />)

    expect(screen.queryByText('절약', { selector: 'span' })).not.toBeInTheDocument()
    await user.click(screen.getByText('우리 팀 상태'))
    expect(screen.getByText('절약', { selector: 'span' })).toBeInTheDocument()
  })

  it('이번 주 할 일과 내집마련 여정은 더 이상 없다', () => {
    seedCouple({ amount: 18_000 * 만, targetYm: TARGET })
    renderScreen(<Roadmap />)
    expect(screen.queryByText('이번 주 할 일')).not.toBeInTheDocument()
    expect(screen.queryByText('내집마련 여정')).not.toBeInTheDocument()
    expect(screen.queryByText('지금 여기')).not.toBeInTheDocument()
  })
})
