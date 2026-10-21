import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'me' } } } }) },
  },
}))

const api = vi.hoisted(() => ({
  fetchQuestions: vi.fn(),
  fetchQuestion: vi.fn(),
  createQuestion: vi.fn(),
  amIStaff: vi.fn(),
  addAnswer: vi.fn(),
  createConsultRequest: vi.fn(),
}))
vi.mock('../lib/qna', async (orig) => ({ ...(await orig<typeof import('../lib/qna')>()), ...api }))

import Qna from './Qna'
import Consult from './Consult'

function open(path: string) {
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/qna" element={<Qna />} />
        <Route path="/qna/:id" element={<Qna />} />
        <Route path="/consult" element={<Consult />} />
      </Routes>
    </MemoryRouter>,
  )
  return { user }
}

const Q = {
  id: 'q1',
  category: 'home' as const,
  title: '전세 만기 1년 남았는데 청약 vs 매매',
  body: '맞벌이 월 650, 모은 돈 1.8억이에요',
  nickname: '익명의 부부 12',
  answered: true,
  hidden: false,
  createdAt: '2026-10-20T03:00:00Z',
  mine: false,
}

describe('묻고 답하기', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset())
    api.amIStaff.mockResolvedValue(false)
  })

  it('목록에 분류와 답변 상태가 보인다', async () => {
    api.fetchQuestions.mockResolvedValue([Q])
    open('/qna')
    expect(await screen.findByText(Q.title)).toBeInTheDocument()
    expect(screen.getByText('답변 완료')).toBeInTheDocument()
    expect(screen.getAllByText('내집마련').length).toBeGreaterThan(0)
  })

  it('콘텐츠 활용 안내를 확인해야 질문이 올라간다', async () => {
    api.createQuestion.mockResolvedValue('new1')
    api.fetchQuestion.mockResolvedValue({ question: { ...Q, id: 'new1' }, answers: [] })
    const { user } = open('/qna/new')
    expect(await screen.findByText(/유튜브·인스타 콘텐츠로 소개될 수 있어요/)).toBeInTheDocument()
    expect(screen.getByText(/1:1 유료 상담/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '내집마련' }))
    // 분류를 고르면 그 분류의 형식이 채워진다 (2026-10-21)
    expect((screen.getByLabelText('내용') as HTMLTextAreaElement).value).toContain('청약 가점')
    await user.type(screen.getByLabelText('제목'), '청약 vs 매매')
    await user.clear(screen.getByLabelText('내용'))
    await user.type(screen.getByLabelText('내용'), '전세 만기가 1년 남았어요')
    await user.click(screen.getByRole('button', { name: '질문 올리기' }))
    expect(screen.getByText('아래 안내를 확인하고 체크해 주세요')).toBeInTheDocument()
    expect(api.createQuestion).not.toHaveBeenCalled()

    await user.click(screen.getByLabelText('위 내용을 확인했어요'))
    await user.click(screen.getByRole('button', { name: '질문 올리기' }))
    expect(api.createQuestion).toHaveBeenCalledWith({
      category: 'home',
      title: '청약 vs 매매',
      body: '전세 만기가 1년 남았어요',
    })
  })

  it('답변하는 사람에게만 답 달기 칸이 보인다', async () => {
    api.fetchQuestion.mockResolvedValue({ question: Q, answers: [] })
    api.amIStaff.mockResolvedValue(true)
    api.addAnswer.mockResolvedValue(undefined)
    const { user } = open('/qna/q1')
    await screen.findByText(Q.title)
    await user.type(await screen.findByLabelText('답'), '저희라면 두 길을 동시에 봐요')
    await user.click(screen.getByRole('button', { name: '답 올리기' }))
    expect(api.addAnswer).toHaveBeenCalledWith('q1', '저희라면 두 길을 동시에 봐요')
  })

  it('일반 사용자에겐 답 달기 칸이 없다', async () => {
    api.fetchQuestion.mockResolvedValue({ question: Q, answers: [] })
    open('/qna/q1')
    await screen.findByText(Q.title)
    expect(screen.queryByLabelText('답')).not.toBeInTheDocument()
  })
})

describe('1:1 상담 신청', () => {
  it('원팀 신청서 질문 + 지금 사는 곳·자산까지 채우면 신청이 간다', async () => {
    api.createConsultRequest.mockResolvedValue(undefined)
    const { user } = open('/consult')
    await user.click(screen.getByRole('button', { name: '상담 신청하기' }))
    expect(screen.getByText('닉네임을 적어 주세요')).toBeInTheDocument()

    const boxes = () => screen.getAllByRole('textbox')
    await user.click(screen.getByRole('button', { name: /기본 상담/ }))
    await user.type(boxes()[0], '결영')
    await user.type(screen.getByPlaceholderText(/휴대폰 번호/), '010-0000-0000')
    await user.click(screen.getByRole('button', { name: '기본적인 건 알아요' }))
    await user.click(screen.getByRole('button', { name: '매매' }))
    await user.type(screen.getByPlaceholderText(/동탄2동/), '경기 화성시 동탄2동')
    await user.click(screen.getByRole('button', { name: '전세' }))
    const money = boxes().filter((b) => b.getAttribute('inputmode') === 'numeric')
    for (const [i, v] of ['200000000', '500000000', '6500000', '1500000'].entries())
      await user.type(money[i], v)
    await user.type(screen.getByPlaceholderText(/예적금 8,000만/), '예적금 8,000만')
    await user.type(screen.getByPlaceholderText(/2년 안에/), '2년 안에 1명')
    await user.type(screen.getByPlaceholderText(/시댁 수원/), '시댁 수원, 처가 대전')
    await user.click(screen.getByRole('button', { name: '세종' }))
    await user.type(screen.getByPlaceholderText(/남편 판교/), '세종 정부청사')
    await user.type(screen.getByPlaceholderText(/가장 고민되는 것/), '내년 전세 만기라 고민이에요')
    await user.type(screen.getByPlaceholderText(/11\/3\(월\)/), '11/3 21시, 11/5 10시, 11/8 13시')
    await user.click(screen.getByLabelText('동의해요'))
    await user.click(screen.getByRole('button', { name: '상담 신청하기' }))
    expect(api.createConsultRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '결영',
        plan: 'basic',
        region: '세종',
        details: expect.objectContaining({
          homeNow: '경기 화성시 동탄2동',
          homeType: '전세',
          cash: 200_000_000,
          maxBudget: 500_000_000,
          assets: '예적금 8,000만',
        }),
      }),
    )
    expect(await screen.findByText('신청 받았어요')).toBeInTheDocument()
  })
})
