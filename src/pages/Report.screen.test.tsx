import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'

const fetchReportRequests = vi.fn()
const insertReportRequest = vi.fn()
const revokeReportConsent = vi.fn()

vi.mock('../lib/db', () => ({
  fetchReportRequests: (...a: unknown[]) => fetchReportRequests(...a),
  insertReportRequest: (...a: unknown[]) => insertReportRequest(...a),
  revokeReportConsent: (...a: unknown[]) => revokeReportConsent(...a),
}))

import Report from './Report'
import { renderScreen, seedStore } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'

function openReport() {
  seedStore({})
  useLedgerStore.setState({ householdId: 'hh-1' })
  return renderScreen(<Report />)
}

describe('맞춤 리포트 신청 — 데이터 공유 동의', () => {
  beforeEach(() => {
    fetchReportRequests.mockResolvedValue([])
    insertReportRequest.mockResolvedValue(undefined)
    revokeReportConsent.mockResolvedValue(undefined)
  })

  // 남의 가계부를 사람이 열어보는 서비스다. 동의 없이 신청이 나가면 안 된다.
  it('동의 없이는 연락처를 채워도 신청할 수 없다', async () => {
    const { user } = openReport()
    await waitFor(() => expect(fetchReportRequests).toHaveBeenCalled())

    await user.type(screen.getByPlaceholderText('이메일 주소'), 'gyeol@example.com')
    expect(screen.getByRole('button', { name: '신청하기' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '신청하기' }))
    expect(insertReportRequest).not.toHaveBeenCalled()
  })

  it('동의만 하고 연락처가 없어도 신청할 수 없다', async () => {
    const { user } = openReport()
    await waitFor(() => expect(fetchReportRequests).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: /동의하고 가계부 열람을 허용/ }))
    expect(screen.getByRole('button', { name: '신청하기' })).toBeDisabled()
  })

  it('동의 + 연락처가 있으면 신청이 나간다', async () => {
    const { user } = openReport()
    await waitFor(() => expect(fetchReportRequests).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: /동의하고 가계부 열람을 허용/ }))
    await user.type(screen.getByPlaceholderText('이메일 주소'), 'gyeol@example.com')
    await user.click(screen.getByRole('button', { name: '신청하기' }))

    await waitFor(() =>
      expect(insertReportRequest).toHaveBeenCalledWith('hh-1', { email: 'gyeol@example.com', contact: undefined, note: undefined }),
    )
  })

  it('무엇을 열람하는지 화면에 적혀 있다', async () => {
    openReport()
    await waitFor(() => expect(fetchReportRequests).toHaveBeenCalled())

    expect(screen.getByText(/월별 수입 · 지출 · 저축 내역/)).toBeInTheDocument()
    expect(screen.getByText(/자산과 부채 목록/)).toBeInTheDocument()
    expect(screen.getByText(/고백 기록은 보지 않아요/)).toBeInTheDocument()
  })

  it('이미 신청했으면 상태와 철회 버튼이 보인다', async () => {
    fetchReportRequests.mockResolvedValue([
      {
        id: 'r1',
        email: 'gyeol@example.com',
        consentAt: '2026-08-04T00:00:00.000Z',
        revokedAt: null,
        status: 'writing',
        createdAt: '2026-08-04T00:00:00.000Z',
      },
    ])
    const { user } = openReport()

    await waitFor(() => expect(screen.getByText('작성 중')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: '신청하기' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /철회하기/ }))
    await waitFor(() => expect(revokeReportConsent).toHaveBeenCalledWith('r1'))
  })

  it('철회한 신청은 없는 것으로 보고 다시 신청할 수 있다', async () => {
    fetchReportRequests.mockResolvedValue([
      {
        id: 'r0',
        email: 'gyeol@example.com',
        consentAt: '2026-07-01T00:00:00.000Z',
        revokedAt: '2026-07-10T00:00:00.000Z',
        status: 'canceled',
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ])
    openReport()

    await waitFor(() => expect(screen.getByRole('button', { name: '신청하기' })).toBeInTheDocument())
  })
})

describe('맞춤 리포트 신청 — 이메일', () => {
  beforeEach(() => {
    fetchReportRequests.mockResolvedValue([])
    insertReportRequest.mockResolvedValue(undefined)
  })

  it('이메일 형식이 아니면 신청할 수 없다', async () => {
    const { user } = openReport()
    await waitFor(() => expect(fetchReportRequests).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: /동의하고 가계부 열람을 허용/ }))
    await user.type(screen.getByPlaceholderText('이메일 주소'), '결영')

    expect(screen.getByText(/이메일 주소를 다시 확인해 주세요/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '신청하기' })).toBeDisabled()
  })

  it('카톡 닉네임은 선택이라 비워도 신청된다', async () => {
    const { user } = openReport()
    await waitFor(() => expect(fetchReportRequests).toHaveBeenCalled())

    await user.click(screen.getByRole('button', { name: /동의하고 가계부 열람을 허용/ }))
    await user.type(screen.getByPlaceholderText('이메일 주소'), 'a@b.co')
    await user.click(screen.getByRole('button', { name: '신청하기' }))

    await waitFor(() => expect(insertReportRequest).toHaveBeenCalled())
  })
})
