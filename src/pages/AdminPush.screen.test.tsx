import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminPush from './AdminPush'
import * as pushAdmin from '../lib/pushAdmin'

vi.mock('../lib/pushAdmin', async (orig) => ({
  ...(await orig<typeof import('../lib/pushAdmin')>()),
  fetchCampaigns: vi.fn(),
  createCampaign: vi.fn(),
  cancelCampaign: vi.fn(),
  audienceCount: vi.fn(),
}))
vi.mock('../lib/posts', async (orig) => ({
  ...(await orig<typeof import('../lib/posts')>()),
  fetchPosts: vi.fn().mockResolvedValue([]),
}))

const scheduled: pushAdmin.Campaign = {
  id: 'c1',
  kind: 'notice',
  title: '점검 안내',
  body: '내일 새벽 2시 점검해요',
  path: '/',
  sendAt: '2026-12-01T00:30:00.000Z',
  status: 'scheduled',
  sentCount: 0,
  failCount: 0,
}

beforeEach(() => {
  vi.mocked(pushAdmin.fetchCampaigns).mockResolvedValue([scheduled])
  vi.mocked(pushAdmin.createCampaign).mockResolvedValue()
  vi.mocked(pushAdmin.cancelCampaign).mockResolvedValue()
  vi.mocked(pushAdmin.audienceCount).mockResolvedValue(3)
})

async function fill(kind: '공지' | '홍보', title: string, body: string) {
  await userEvent.selectOptions(screen.getByRole('combobox', { name: '종류' }), kind)
  await userEvent.type(screen.getByRole('textbox', { name: '제목' }), title)
  await userEvent.type(screen.getByRole('textbox', { name: '내용' }), body)
}

describe('관리자 > 알림 보내기', () => {
  it('홍보 미리보기에 (광고)와 수신 거부 문구가 붙는다', async () => {
    render(<AdminPush />)
    await fill('홍보', '연말 특강', '자리 남았어요')
    expect(screen.getByText('(광고) 연말 특강')).toBeInTheDocument()
    expect(screen.getByText(/자리 남았어요\s*수신 거부: 설정 > 알림/)).toBeInTheDocument()
  })

  it('홍보는 21~08시를 예약할 수 없다', async () => {
    render(<AdminPush />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '종류' }), '홍보')
    await userEvent.click(screen.getByRole('radio', { name: '예약' }))
    const time = screen.getByRole('combobox', { name: '시각' })
    const opts = Array.from((time as HTMLSelectElement).options).map((o) => o.value)
    expect(opts).toContain('08:00')
    expect(opts).toContain('20:30')
    expect(opts).not.toContain('21:00')
    expect(opts).not.toContain('07:30')

    await userEvent.selectOptions(screen.getByRole('combobox', { name: '종류' }), '공지')
    const all = Array.from((screen.getByRole('combobox', { name: '시각' }) as HTMLSelectElement).options).map((o) => o.value)
    expect(all).toContain('21:00')
  })

  it('지금 보내기: 대상 수를 확인하고 저장한다', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AdminPush />)
    await fill('공지', '새 기능', '정산이 쉬워졌어요')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '열릴 화면' }), '/monthly')
    await userEvent.click(screen.getByRole('button', { name: '보내기' }))
    expect(pushAdmin.audienceCount).toHaveBeenCalledWith('notice')
    expect(confirm).toHaveBeenCalledWith('3명에게 보내요. 보낼까요?')
    expect(pushAdmin.createCampaign).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'notice', title: '새 기능', body: '정산이 쉬워졌어요', path: '/monthly' }),
    )
    expect(await screen.findByText(/보내져요|예약했어요/)).toBeInTheDocument()
  })

  it('확인에서 취소하면 저장하지 않는다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<AdminPush />)
    await fill('공지', '새 기능', '정산이 쉬워졌어요')
    await userEvent.click(screen.getByRole('button', { name: '보내기' }))
    expect(pushAdmin.createCampaign).not.toHaveBeenCalled()
  })

  it('목록에서 예약을 취소한다', async () => {
    render(<AdminPush />)
    await userEvent.click(await screen.findByRole('button', { name: '점검 안내 예약 취소' }))
    expect(pushAdmin.cancelCampaign).toHaveBeenCalledWith('c1')
  })
})
