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

describe('고백 페이지 — 우리집 기록 보기·삭제', () => {
  it('배우자 기록도 날짜별로 보이고, 둘 다 지울 수 있다', async () => {
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
        // 배우자 것 — 대신 적어줄 수 있으니 대신 고칠 수도 있어야 한다
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
    expect(screen.getByText('카페/간식')).toBeInTheDocument()

    const buttons = screen.getAllByLabelText('기록 삭제')
    expect(buttons).toHaveLength(3)

    await user.click(buttons[0])
    expect(useLedgerStore.getState().confessions).toHaveLength(2)
  })

  it('배우자 기록도 지울 수 있다', async () => {
    seedStore({
      memberNo: 2,
      confessions: [
        {
          id: 'his',
          memberNo: 1,
          category: '카페/간식',
          kind: 'variable',
          amount: 5_500,
          createdAt: new Date().toISOString(),
        },
      ],
    })
    const { user } = renderScreen(<Confess />)

    await user.click(screen.getByLabelText('기록 삭제'))
    expect(useLedgerStore.getState().confessions).toHaveLength(0)
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
    expect(screen.queryByText(/우리집 기록/)).not.toBeInTheDocument()
  })
})

describe('고백 페이지 — 누가 썼는지', () => {
  it('기본은 내 지출로 적힌다', async () => {
    seedStore({ memberNo: 2, confessions: [] })
    const { user } = renderScreen(<Confess />)

    await user.click(screen.getByText(/안 썼어요/))
    expect(useLedgerStore.getState().confessions[0].memberNo).toBe(2)
  })

  it('배우자를 고르면 배우자 지출로 적힌다 — 한 사람이 몰아서 적을 수 있다', async () => {
    seedStore({ memberNo: 2, confessions: [] })
    const { user } = renderScreen(<Confess />)

    await user.click(screen.getByLabelText('쓴 사람 남편'))
    await user.click(screen.getByText(/안 썼어요/))

    expect(useLedgerStore.getState().confessions[0].memberNo).toBe(1)
  })

  it('쓴 사람을 바꾸면 카드 주인도 따라간다 (직접 고르기 전까지)', async () => {
    seedStore({ memberNo: 2, confessions: [] })
    const { user } = renderScreen(<Confess />)

    await user.click(screen.getByLabelText('쓴 사람 남편'))
    await user.click(screen.getByText(/안 썼어요/))

    const saved = useLedgerStore.getState().confessions[0]
    expect(saved.memberNo).toBe(1)
    expect(saved.cardOwner).toBe(1)
  })

  it('카드 주인을 직접 고르면 쓴 사람을 바꿔도 안 따라간다', async () => {
    seedStore({ memberNo: 2, confessions: [] })
    const { user } = renderScreen(<Confess />)

    // 아내가 쓰지만 남편 카드로 — 골라둔 뒤 쓴 사람을 남편으로 바꿔도 카드는 그대로
    await user.click(screen.getByLabelText('카드 주인 아내'))
    await user.click(screen.getByLabelText('쓴 사람 남편'))
    await user.click(screen.getByText(/안 썼어요/))

    const saved = useLedgerStore.getState().confessions[0]
    expect(saved.memberNo).toBe(1)
    expect(saved.cardOwner).toBe(2)
  })
})

describe('고백 페이지 — 누구 카드로 썼는지', () => {
  it('기본은 내 카드고, 기록에 카드 주인이 붙는다', async () => {
    seedStore({ memberNo: 2, confessions: [] })
    const { user } = renderScreen(<Confess />)

    expect(screen.getByText('누구 카드로요?')).toBeInTheDocument()
    await user.click(screen.getByText(/안 썼어요/))

    // 무지출(0원)도 변동지출이라 카드 주인이 붙는다 — 금액이 0이라 계산엔 영향 없다
    expect(useLedgerStore.getState().confessions[0].cardOwner).toBe(2)
  })

  it('배우자 카드로 바꾸면 그쪽으로 기록된다', async () => {
    seedStore({ memberNo: 2, confessions: [] })
    const { user } = renderScreen(<Confess />)

    await user.click(screen.getByLabelText('카드 주인 남편'))
    await user.click(screen.getByText(/안 썼어요/))

    const saved = useLedgerStore.getState().confessions[0]
    expect(saved.cardOwner).toBe(1)
    // 카드만 바꿨을 뿐 — 지출은 여전히 내 것
    expect(saved.memberNo).toBe(2)
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

describe('소비 기록 — 남편 · 아내 · 공동', () => {
  it('쓴 사람 칸에 세 가지가 있다', () => {
    seedStore({ memberNo: 2, confessions: [] })
    renderScreen(<Confess />)
    expect(screen.getByLabelText('쓴 사람 남편')).toBeInTheDocument()
    expect(screen.getByLabelText('쓴 사람 아내')).toBeInTheDocument()
    expect(screen.getByLabelText('쓴 사람 공동')).toBeInTheDocument()
  })

  it('공동을 고르면 적은 사람 번호 + 공동 표시로 저장된다', async () => {
    seedStore({ memberNo: 2, confessions: [] })
    const { user } = renderScreen(<Confess />)

    await user.click(screen.getByLabelText('쓴 사람 공동'))
    await user.click(screen.getByRole('button', { name: '버튼으로 고르기' }))
    await user.click(screen.getByRole('button', { name: '식비' }))
    await user.click(screen.getByRole('button', { name: '+10,000' }))
    await user.click(screen.getByRole('button', { name: '기록하기' }))

    const saved = useLedgerStore.getState().confessions[0]
    expect(saved.shared).toBe(true)
    expect(saved.memberNo).toBe(2) // 정산은 사람별 — 적은 사람 몫으로 잡힌다
  })

  it('공동을 골라도 카드 주인은 멋대로 안 바뀐다', async () => {
    seedStore({ memberNo: 2, confessions: [] })
    const { user } = renderScreen(<Confess />)
    await user.click(screen.getByLabelText('쓴 사람 공동'))
    expect(screen.getByLabelText('카드 주인 아내')).toHaveAttribute('aria-pressed', 'true')
  })

  it("공동 상태에선 '안 썼어요' 버튼이 없다 — 공동 무지출은 말이 안 된다", async () => {
    seedStore({ memberNo: 2, confessions: [] })
    const { user } = renderScreen(<Confess />)
    expect(screen.getByText(/안 썼어요/)).toBeInTheDocument()
    await user.click(screen.getByLabelText('쓴 사람 공동'))
    expect(screen.queryByText(/안 썼어요/)).not.toBeInTheDocument()
  })

  it("사람을 고른 기록엔 공동 표시가 안 붙는다", async () => {
    seedStore({ memberNo: 2, confessions: [] })
    const { user } = renderScreen(<Confess />)
    await user.click(screen.getByText(/안 썼어요/))
    expect(useLedgerStore.getState().confessions[0].shared).toBeUndefined()
  })

  it("목록에서 공동 기록은 '공동' 이름표를 단다", () => {
    seedStore({
      memberNo: 2,
      confessions: [
        {
          id: 's1',
          memberNo: 2,
          shared: true,
          category: '식비',
          kind: 'variable',
          amount: 30_000,
          createdAt: new Date().toISOString(),
        },
      ],
    })
    renderScreen(<Confess />)
    const row = screen.getByText('식비').closest('div')!
    expect(row.textContent).toContain('공동')
    expect(row.textContent).not.toContain('아내')
  })
})

describe('소비 기록 — 지난 날짜로 적은 게 사라지지 않는다 (제보 9/15·9/16)', () => {
  it('14일보다 오래된 날짜를 골라도 그 날 기록이 목록에 보인다', () => {
    const old = daysAgo(20)
    seedStore({
      memberNo: 2,
      confessions: [
        { id: 'o', memberNo: 2, category: '식비', kind: 'variable', amount: 9_000, createdAt: new Date(`${ymd(old)}T12:00:00`).toISOString() },
      ],
    })
    renderScreen(<Confess />)
    expect(screen.queryByText('식비')).not.toBeInTheDocument()
    fireEvent.change(screen.getByDisplayValue(ymd(new Date())), { target: { value: ymd(old) } })
    expect(screen.getByText('식비')).toBeInTheDocument()
  })

  it("지난 날짜를 고르면 '버튼으로 고르기' 화면에도 그 날짜가 보인다", async () => {
    seedStore({ memberNo: 2, confessions: [] })
    const { user } = renderScreen(<Confess />)
    fireEvent.change(screen.getByDisplayValue(ymd(new Date())), { target: { value: ymd(daysAgo(5)) } })
    await user.click(screen.getByRole('button', { name: '버튼으로 고르기' }))
    expect(screen.getByText(/기록으로 적는 중/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '오늘로' }))
    expect(screen.queryByText(/기록으로 적는 중/)).not.toBeInTheDocument()
  })

  it('오늘 날짜면 띠가 없다', async () => {
    seedStore({ memberNo: 2, confessions: [] })
    const { user } = renderScreen(<Confess />)
    await user.click(screen.getByRole('button', { name: '버튼으로 고르기' }))
    expect(screen.queryByText(/기록으로 적는 중/)).not.toBeInTheDocument()
  })
})

describe('소비 기록 — 고치기 (제보 4건)', () => {
  const one = () =>
    seedStore({
      memberNo: 2,
      confessions: [
        { id: 'c1', memberNo: 2, category: '식비', kind: 'variable', amount: 9_000, note: '점심', createdAt: new Date().toISOString() },
      ],
    })

  it('눌러서 금액·항목·메모를 고친다 — 누가 썼는지·날짜는 그대로', async () => {
    one()
    const { user } = renderScreen(<Confess />)
    await user.click(screen.getByRole('button', { name: '식비 기록 고치기' }))

    const amount = screen.getByLabelText('금액')
    await user.clear(amount)
    await user.type(amount, '12000')
    await user.selectOptions(screen.getByLabelText('항목'), 'variable:카페')
    await user.click(screen.getByRole('button', { name: '고치기' }))

    const c = useLedgerStore.getState().confessions[0]
    expect(c.amount).toBe(12_000)
    expect(c.category).toBe('카페')
    expect(c.memberNo).toBe(2)
    expect(useLedgerStore.getState().confessions).toHaveLength(1) // 새로 생기지 않는다
  })

  it('그대로 두기를 누르면 안 바뀐다', async () => {
    one()
    const { user } = renderScreen(<Confess />)
    await user.click(screen.getByRole('button', { name: '식비 기록 고치기' }))
    await user.click(screen.getByRole('button', { name: '그대로 두기' }))
    expect(useLedgerStore.getState().confessions[0].amount).toBe(9_000)
  })
})

describe('소비 기록 — 들어온 돈도 바로 적는다 (제보 9/11)', () => {
  it("버튼 화면에 '수입' 칸이 있고, 수입으로 저장된다", async () => {
    seedStore({ memberNo: 2, confessions: [] })
    const { user } = renderScreen(<Confess />)
    await user.click(screen.getByRole('button', { name: '버튼으로 고르기' }))
    expect(screen.getByText(/수입 · 들어온 돈/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '부수입' }))
    await user.click(screen.getByRole('button', { name: '+50,000' }))
    await user.click(screen.getByRole('button', { name: '기록하기' }))

    const c = useLedgerStore.getState().confessions[0]
    expect(c.kind).toBe('income')
    expect(c.category).toBe('부수입')
    expect(c.cardOwner).toBeUndefined() // 수입엔 카드 주인을 안 남긴다
  })
})
