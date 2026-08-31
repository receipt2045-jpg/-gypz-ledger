import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import Onboarding from './Onboarding'
import { renderScreen } from '../test/renderScreen'

const CODE = '3F2A9C1B'

// 참여/생성은 서버를 부른다 — 화면 분기만 보므로 호출 자체를 가짜로 둔다
const joinHousehold = vi.fn()
const createHousehold = vi.fn()
vi.mock('../lib/db', () => ({
  joinHousehold: (c: string) => joinHousehold(c),
  createHousehold: () => createHousehold(),
  pushProfile: vi.fn(),
}))

beforeEach(() => localStorage.clear())

describe('가구 연결 화면 — 초대 링크로 온 사람', () => {
  const asInvited = () => localStorage.setItem('moabuli_invite', CODE)

  it("'새 가계부 만들기'를 보여주지 않는다 — 그걸 눌러 딴 집을 만들어 버린다", () => {
    asInvited()
    renderScreen(<Onboarding onDone={vi.fn()} />)

    expect(screen.queryByText('새 가계부 만들기')).not.toBeInTheDocument()
    expect(screen.getByText('초대를 받으셨네요!')).toBeInTheDocument()
  })

  it('코드가 이미 채워져 있고, 받아 적을 칸이 없다', () => {
    asInvited()
    renderScreen(<Onboarding onDone={vi.fn()} />)

    expect(screen.getByText(CODE)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/8자리 코드/)).not.toBeInTheDocument()
  })

  it('버튼 한 번으로 그 코드에 참여한다', async () => {
    asInvited()
    joinHousehold.mockResolvedValue({ householdId: 'h1', memberNo: 2 })
    const onDone = vi.fn()
    const { user } = renderScreen(<Onboarding onDone={onDone} />)

    await user.click(screen.getByRole('button', { name: '참여하기' }))

    expect(joinHousehold).toHaveBeenCalledWith(CODE)
    expect(onDone).toHaveBeenCalledWith({ householdId: 'h1', memberNo: 2 })
  })

  it('참여하고 나면 초대 코드를 지운다 — 다음에 또 이 화면이 뜨면 안 된다', async () => {
    asInvited()
    joinHousehold.mockResolvedValue({ householdId: 'h1', memberNo: 2 })
    const { user } = renderScreen(<Onboarding onDone={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: '참여하기' }))

    expect(localStorage.getItem('moabuli_invite')).toBeNull()
  })

  it('빠져나갈 길은 남겨둔다 — 누르면 원래 화면으로 돌아간다', async () => {
    asInvited()
    const { user } = renderScreen(<Onboarding onDone={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /새로 시작하고 싶어요/ }))

    expect(screen.getByText('새 가계부 만들기')).toBeInTheDocument()
    expect(localStorage.getItem('moabuli_invite')).toBeNull()
  })
})

describe('가구 연결 화면 — 그냥 들어온 사람', () => {
  it('예전처럼 새로 만들기와 코드 입력이 둘 다 있다', () => {
    renderScreen(<Onboarding onDone={vi.fn()} />)

    expect(screen.getByText('새 가계부 만들기')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/8자리 코드/)).toBeInTheDocument()
    expect(screen.queryByText('초대를 받으셨네요!')).not.toBeInTheDocument()
  })

  it('새로 만들기를 고르면 남아 있던 초대 코드는 버린다', async () => {
    localStorage.setItem('moabuli_invite', CODE)
    createHousehold.mockResolvedValue({ householdId: 'h2', memberNo: 1 })
    const { user } = renderScreen(<Onboarding onDone={vi.fn()} />)

    // 초대 화면에서 빠져나온 뒤 새로 만들기
    await user.click(screen.getByRole('button', { name: /새로 시작하고 싶어요/ }))
    await user.click(screen.getByText('새 가계부 만들기'))

    expect(localStorage.getItem('moabuli_invite')).toBeNull()
  })
})
