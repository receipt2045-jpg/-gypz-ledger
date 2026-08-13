import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import InviteBanner from './InviteBanner'
import { renderScreen } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'
import * as db from '../lib/db'

const setHousehold = () =>
  useLedgerStore.setState({
    householdId: 'h1',
    inviteCode: 'ABC123',
    sample: false,
  })

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  setHousehold()
})

describe('배우자 초대 배너', () => {
  it('혼자 쓰는 집이면 뜬다', async () => {
    vi.spyOn(db, 'fetchMemberCount').mockResolvedValue(1)
    renderScreen(<InviteBanner />)
    expect(await screen.findByText('아직 혼자 쓰고 계세요')).toBeInTheDocument()
  })

  it('배우자가 이미 합류했으면 안 뜬다', async () => {
    vi.spyOn(db, 'fetchMemberCount').mockResolvedValue(2)
    renderScreen(<InviteBanner />)
    await waitFor(() => expect(db.fetchMemberCount).toHaveBeenCalled())
    expect(screen.queryByText('아직 혼자 쓰고 계세요')).not.toBeInTheDocument()
  })

  it('조회에 실패하면 뜨지 않는다 (이미 합류한 집에 잘못 뜨는 게 더 나쁘다)', async () => {
    vi.spyOn(db, 'fetchMemberCount').mockRejectedValue(new Error('offline'))
    renderScreen(<InviteBanner />)
    await waitFor(() => expect(db.fetchMemberCount).toHaveBeenCalled())
    expect(screen.queryByText('아직 혼자 쓰고 계세요')).not.toBeInTheDocument()
  })

  it('닫으면 다시 안 뜬다', async () => {
    vi.spyOn(db, 'fetchMemberCount').mockResolvedValue(1)
    const { user, unmount } = renderScreen(<InviteBanner />)
    await screen.findByText('아직 혼자 쓰고 계세요')

    await user.click(screen.getByLabelText('배너 닫기'))
    expect(screen.queryByText('아직 혼자 쓰고 계세요')).not.toBeInTheDocument()

    unmount()
    renderScreen(<InviteBanner />)
    await waitFor(() => expect(db.fetchMemberCount).toHaveBeenCalled())
    expect(screen.queryByText('아직 혼자 쓰고 계세요')).not.toBeInTheDocument()
  })
})
