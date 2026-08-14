import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import Confess from './Confess'
import { renderScreen, seedStore } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'

const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}
const ymd = (d: Date) => d.toLocaleDateString('sv-SE')

describe('고백 페이지 — 내 기록 보기·삭제', () => {
  it('지난 기록도 날짜별로 보이고, 내 것만 지울 수 있다', async () => {
    seedStore({
      memberNo: 2,
      confessions: [
        {
          id: 'c1',
          memberNo: 2,
          category: '식비',
          kind: 'variable',
          amount: 9_000,
          note: '점심',
          createdAt: new Date().toISOString(),
        },
        // 사흘 전 내 기록 — 오늘 것만 보여주면 이게 안 보였다
        {
          id: 'c3',
          memberNo: 2,
          category: '교통',
          kind: 'variable',
          amount: 1_500,
          createdAt: daysAgo(3).toISOString(),
        },
        // 배우자 것 — 내 목록엔 안 보인다
        {
          id: 'c2',
          memberNo: 1,
          category: '카페/간식',
          kind: 'variable',
          amount: 5_500,
          createdAt: new Date().toISOString(),
        },
      ],
    })
    const { user } = renderScreen(<Confess />)

    expect(screen.getByText('식비')).toBeInTheDocument()
    expect(screen.getByText('교통')).toBeInTheDocument()
    expect(screen.queryByText('카페/간식')).not.toBeInTheDocument()

    const buttons = screen.getAllByLabelText('고백 삭제')
    expect(buttons).toHaveLength(2)

    await user.click(buttons[0])
    expect(useLedgerStore.getState().confessions).toHaveLength(2)
  })

  it('14일보다 오래된 기록은 목록에 없다', () => {
    seedStore({
      memberNo: 2,
      confessions: [
        {
          id: 'old',
          memberNo: 2,
          category: '식비',
          kind: 'variable',
          amount: 9_000,
          createdAt: daysAgo(20).toISOString(),
        },
      ],
    })
    renderScreen(<Confess />)
    expect(screen.queryByText(/내 기록/)).not.toBeInTheDocument()
  })
})

describe('고백 페이지 — 누구 카드로 썼는지', () => {
  it('기본은 내 카드고, 기록에 카드 주인이 붙는다', async () => {
    seedStore({ memberNo: 2, confessions: [] })
    const { user } = renderScreen(<Confess />)

    expect(screen.getByText('누구 카드로 썼어요?')).toBeInTheDocument()
    await user.click(screen.getByText(/안 썼어요/))

    // 무지출(0원)도 변동지출이라 카드 주인이 붙는다 — 금액이 0이라 계산엔 영향 없다
    expect(useLedgerStore.getState().confessions[0].cardOwner).toBe(2)
  })

  it('배우자 카드로 바꾸면 그쪽으로 기록된다', async () => {
    seedStore({ memberNo: 2, confessions: [] })
    const { user } = renderScreen(<Confess />)

    await user.click(screen.getByRole('button', { name: '남편' }))
    await user.click(screen.getByText(/안 썼어요/))

    expect(useLedgerStore.getState().confessions[0].cardOwner).toBe(1)
  })
})

describe('고백 페이지 — 지난 날짜로 적기', () => {
  it('날짜를 바꾸면 그 날짜로 기록된다', async () => {
    seedStore({ memberNo: 2, confessions: [] })
    const { user } = renderScreen(<Confess />)

    const target = ymd(daysAgo(2))
    // date input은 타이핑이 아니라 값 변경으로 다룬다
    fireEvent.change(screen.getByDisplayValue(ymd(new Date())), { target: { value: target } })

    // 지난 날짜를 고르면 무지출 문구가 '이 날은'으로 바뀐다
    await user.click(screen.getByText(/안 썼어요/))

    const saved = useLedgerStore.getState().confessions
    expect(saved).toHaveLength(1)
    expect(ymd(new Date(saved[0].createdAt))).toBe(target)
  })
})
