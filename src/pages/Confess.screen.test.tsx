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

    // 2026-11-26 종류 칸이 바로 고르는 칸 — 고른 값으로 찾는다
    expect(screen.getByDisplayValue('식비')).toBeInTheDocument()
    expect(screen.getByDisplayValue('교통')).toBeInTheDocument()
    expect(screen.getByDisplayValue('카페/간식')).toBeInTheDocument()

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
          note: '예전 장보기',
          createdAt: daysAgo(20).toISOString(),
        },
      ],
    })
    renderScreen(<Confess />)
    // 금액으로 찾으면 20일 전이 이번 달일 때 '이번 달 쓴 돈' 카드에 걸린다(11/21에 실패) — 메모로 목록만 본다
    expect(screen.queryByText(/예전 장보기/)).not.toBeInTheDocument()
    // 최근 14일이 비어도 '지난 기록 더 보기'는 보인다 (2026-11-19 점검)
    expect(screen.getByText(/부터는 기록이 없어요/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /지난 기록 더 보기/ })).toBeInTheDocument()
  })

  it('더 보기를 누르면 그 앞 기록이 나온다', async () => {
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
    const { user } = renderScreen(<Confess />)
    await user.click(screen.getByRole('button', { name: /지난 기록 더 보기/ }))
    expect(screen.getAllByText('9,000원').length).toBeGreaterThan(0)
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

    expect(screen.getByText('어떻게 냈어요?')).toBeInTheDocument()
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

  it('사람을 고른 기록엔 공동 표시가 안 붙는다', async () => {
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
    // 2026-11-26 누가 칸이 고르는 칸 — 공동이 골라져 있다
    expect(screen.getByLabelText('식비 누가')).toHaveDisplayValue('공동')
  })
})

describe('소비 기록 — 지난 날짜로 적은 게 사라지지 않는다 (제보 9/15·9/16)', () => {
  it('14일보다 오래된 날짜를 골라도 그 날 기록이 목록에 보인다', () => {
    const old = daysAgo(20)
    seedStore({
      memberNo: 2,
      confessions: [
        {
          id: 'o',
          memberNo: 2,
          category: '식비',
          kind: 'variable',
          amount: 9_000,
          createdAt: new Date(`${ymd(old)}T12:00:00`).toISOString(),
        },
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
    fireEvent.change(screen.getByDisplayValue(ymd(new Date())), {
      target: { value: ymd(daysAgo(5)) },
    })
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
        {
          id: 'c1',
          memberNo: 2,
          category: '식비',
          kind: 'variable',
          amount: 9_000,
          note: '점심',
          createdAt: new Date().toISOString(),
        },
      ],
    })

  it('칸에서 바로 금액·항목을 고친다 — 누가 썼는지·날짜는 그대로 (2026-11-26 엑셀처럼)', async () => {
    one()
    const { user } = renderScreen(<Confess />)

    const amount = screen.getByLabelText('식비 금액')
    await user.clear(amount)
    await user.type(amount, '12000{Enter}')
    await user.selectOptions(screen.getByLabelText('식비 종류'), 'variable:카페')

    const c = useLedgerStore.getState().confessions[0]
    expect(c.amount).toBe(12_000)
    expect(c.category).toBe('카페')
    expect(c.memberNo).toBe(2)
    expect(useLedgerStore.getState().confessions).toHaveLength(1) // 새로 생기지 않는다
  })

  it('Esc를 누르면 안 바뀌고, 금액을 비우면 원래대로', async () => {
    one()
    const { user } = renderScreen(<Confess />)
    const amount = screen.getByLabelText('식비 금액')
    await user.type(amount, '5{Escape}')
    await user.tab()
    expect(useLedgerStore.getState().confessions[0].amount).toBe(9_000)
    await user.clear(amount)
    await user.tab()
    expect(useLedgerStore.getState().confessions[0].amount).toBe(9_000)
    expect(amount).toHaveValue('9,000')
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

// 의견(2026-10-21): "현금으로 쓴 건 기록 못 하나요?" · "수정할 때 날짜도 바꾸고 싶어요"
describe('고백 페이지 — 현금 · 날짜 고치기', () => {
  it('현금을 고르면 카드 주인 없이 현금으로 기록된다', async () => {
    seedStore({ memberNo: 2, confessions: [] })
    const { user } = renderScreen(<Confess />)
    await user.click(screen.getByLabelText('현금으로 냄'))
    await user.click(screen.getByText(/안 썼어요/))
    const saved = useLedgerStore.getState().confessions[0]
    expect(saved.cash).toBe(true)
    expect(saved.cardOwner).toBeUndefined()
  })

  it('기록을 고칠 때 날짜도 바꿀 수 있다', async () => {
    seedStore({
      memberNo: 2,
      confessions: [
        {
          id: 'c1',
          memberNo: 2,
          category: '식비',
          kind: 'variable',
          amount: 9_000,
          createdAt: new Date().toISOString(),
        },
      ],
    })
    renderScreen(<Confess />)
    const target = ymd(daysAgo(2))
    fireEvent.change(screen.getByLabelText('식비 날짜'), { target: { value: target } })
    const saved = useLedgerStore.getState().confessions[0]
    expect(new Date(saved.createdAt).toLocaleDateString('sv-SE')).toBe(target)
    expect(saved.amount).toBe(9_000)
  })
  it('고칠 때 누가 썼는지·어떻게 냈는지도 바꾼다 (2026-10-27: 공동인데 아내로 적었어요)', async () => {
    seedStore({
      memberNo: 2,
      confessions: [
        {
          id: 'c1',
          memberNo: 2,
          category: '식비',
          kind: 'variable',
          amount: 21_070,
          cardOwner: 2,
          createdAt: new Date().toISOString(),
        },
      ],
    })
    const { user } = renderScreen(<Confess />)
    await user.selectOptions(screen.getByLabelText('식비 누가'), 'shared')
    await user.selectOptions(screen.getByLabelText('식비 결제'), 'cash')
    let saved = useLedgerStore.getState().confessions[0]
    expect(saved.shared).toBe(true)
    expect(saved.cash).toBe(true)
    expect(saved.cardOwner).toBeUndefined()
    expect(saved.memberNo).toBe(2)

    // 다시 남편 몫으로 — 공동 표시가 빠진다
    await user.selectOptions(screen.getByLabelText('식비 누가'), '1')
    saved = useLedgerStore.getState().confessions[0]
    expect(saved.shared).toBeUndefined()
    expect(saved.memberNo).toBe(1)
  })
})

describe('지난 기록 더 보기 (2026-11-17 의견: "과거 기록을 일주일 단위로만 볼 수 있어요")', () => {
  it('처음엔 최근 14일, 더 보기를 누르면 그 앞 기록도 보인다', async () => {
    const daysAgo = (n: number) => {
      const d = new Date()
      d.setDate(d.getDate() - n)
      d.setHours(12, 0, 0, 0)
      return d.toISOString()
    }
    seedStore({
      memberNo: 1,
      confessions: [
        {
          id: 'r',
          memberNo: 1,
          kind: 'variable',
          category: '식비',
          amount: 1000,
          note: '요즘',
          createdAt: daysAgo(2),
        },
        {
          id: 'o',
          memberNo: 1,
          kind: 'variable',
          category: '식비',
          amount: 2000,
          note: '예전',
          createdAt: daysAgo(25),
        },
      ],
    })
    const { user } = renderScreen(<Confess />)
    // 메모는 칸에서 바로 고치는 입력칸 (2026-11-26)
    expect(screen.getByDisplayValue(/요즘/)).toBeInTheDocument()
    expect(screen.queryByDisplayValue(/예전/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /지난 기록 더 보기/ }))
    expect(screen.getByDisplayValue(/예전/)).toBeInTheDocument()
  })
})

describe('고백 페이지 — 달력으로 보기 (2026-11-24)', () => {
  it('달력 칸에 그날 쓴 돈이 나오고, 날짜를 누르면 그날 기록을 고칠 수 있다', async () => {
    seedStore({
      memberNo: 1,
      confessions: [
        {
          id: 'k1',
          memberNo: 1,
          category: '식비',
          kind: 'variable',
          amount: 12_000,
          note: '저녁',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'k2',
          memberNo: 1,
          category: '적금',
          kind: 'saving',
          amount: 500_000,
          createdAt: new Date().toISOString(),
        },
      ],
    })
    const { user } = renderScreen(<Confess />)
    await user.click(screen.getByRole('tab', { name: '달력' }))
    const now = new Date()
    // 저축은 쓴 돈에 안 센다
    expect(
      screen.getByRole('button', {
        name: `${now.getMonth() + 1}월 ${now.getDate()}일 나간 돈 12,000원`,
      }),
    ).toBeInTheDocument()
    // 처음엔 오늘이 골라져 있어 오늘 기록이 보인다
    expect(screen.getByDisplayValue(/저녁/)).toBeInTheDocument()
    expect(screen.getAllByLabelText('기록 삭제')).toHaveLength(2)
    // 그날 기록도 엑셀 표 — 칸에서 바로 고친다 (2026-11-26)
    const memo = screen.getByLabelText('식비 메모')
    await user.clear(memo)
    await user.type(memo, '저녁 외식{Enter}')
    expect(useLedgerStore.getState().confessions.find((c) => c.id === 'k1')?.note).toBe('저녁 외식')
    await user.click(screen.getByRole('button', { name: '지난달 달력' }))
    expect(screen.queryByLabelText('기록 삭제')).toBeNull()
    localStorage.removeItem('moabuli.confess.view')
  })
})

describe('기록마다 메모 (2026-11-24, 11-13 의견)', () => {
  it('줄글로 적을 때 확인 화면에서 메모를 고쳐 남기고, 목록에 메모가 다 보인다', async () => {
    seedStore({ memberNo: 1, confessions: [] })
    const { user } = renderScreen(<Confess />)
    await user.type(screen.getByPlaceholderText(/이라고 말해 보세요/), '점심 9000원')
    await user.click(screen.getByRole('button', { name: '확인하기' }))
    const memo = screen.getByLabelText(/메모$/)
    await user.clear(memo)
    await user.type(memo, '팀 점심, 다음 달에 돌려받기로 함')
    await user.click(screen.getByRole('button', { name: '1건 기록하기' }))
    const saved = useLedgerStore.getState().confessions[0]
    expect(saved.note).toBe('팀 점심, 다음 달에 돌려받기로 함')
  })

  it('목록에서 긴 메모도 잘리지 않고 둘째 줄에 보인다', () => {
    const long = '친구 결혼 축의금 — 우리 결혼 때 10만 원 받아서 같은 금액으로'
    seedStore({
      memberNo: 1,
      confessions: [
        {
          id: 'n1',
          memberNo: 1,
          category: '경조사',
          kind: 'variable',
          amount: 100_000,
          note: long,
          createdAt: new Date().toISOString(),
        },
      ],
    })
    renderScreen(<Confess />)
    expect(screen.getByDisplayValue(long)).toBeInTheDocument() // 메모 칸에 그대로 다 들어 있다
  })
})
