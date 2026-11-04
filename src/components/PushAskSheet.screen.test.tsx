import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import PushAskSheet from './PushAskSheet'
import { renderScreen, seedStore } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'

const h = vi.hoisted(() => ({
  supported: true,
  ask: vi.fn(),
  start: vi.fn(),
  fetchPrefs: vi.fn(),
  createPrefs: vi.fn(),
}))
vi.mock('../lib/pushNative', () => ({
  pushSupported: () => h.supported,
  askPushPermission: () => h.ask(),
  startPush: () => h.start(),
}))
vi.mock('../lib/pushPrefs', async (orig) => ({
  ...(await orig<typeof import('../lib/pushPrefs')>()),
  fetchPrefs: () => h.fetchPrefs(),
  createPrefs: (promo: boolean, now: Date) => h.createPrefs(promo, now),
}))

const TITLE = '놓치지 않게 알려드릴게요'
const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  h.supported = true
  h.ask.mockResolvedValue(true)
  h.start.mockResolvedValue(undefined)
  h.fetchPrefs.mockResolvedValue(null)
  h.createPrefs.mockResolvedValue({})
  localStorage.clear()
  seedStore({})
  useLedgerStore.setState({ householdId: 'h1', sample: false })
})

describe('처음 알림 안내', () => {
  it('앱 + 우리집 + 설정 없음 + 처음이면 뜬다', async () => {
    renderScreen(<PushAskSheet />)
    expect(await screen.findByText(TITLE)).toBeInTheDocument()
    expect(screen.getByText(/기록할 시간 · 밤 9시/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox')).not.toBeChecked() // 광고 동의 기본 해제
  })

  it('웹에선 안 뜨고 서버도 안 부른다', async () => {
    h.supported = false
    renderScreen(<PushAskSheet />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
    expect(h.fetchPrefs).not.toHaveBeenCalled()
  })

  it('둘러보기(예시)에선 안 뜬다', async () => {
    useLedgerStore.setState({ householdId: null, sample: true })
    renderScreen(<PushAskSheet />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
  })

  it('이미 알림 설정이 있으면 안 뜬다', async () => {
    h.fetchPrefs.mockResolvedValue({ reminderOn: true })
    renderScreen(<PushAskSheet />)
    await waitFor(() => expect(h.fetchPrefs).toHaveBeenCalled())
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
  })

  it('3일 전에 [나중에] 했으면 안 뜨고, 8일 지나면 다시 뜬다', async () => {
    localStorage.setItem('pushAskedAt', new Date(Date.now() - 3 * DAY).toISOString())
    const first = renderScreen(<PushAskSheet />)
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
    first.unmount()

    localStorage.setItem('pushAskedAt', new Date(Date.now() - 8 * DAY).toISOString())
    renderScreen(<PushAskSheet />)
    expect(await screen.findByText(TITLE)).toBeInTheDocument()
  })

  it('광고 체크 후 [알림 받기] → 권한 → 설정 저장 → 토큰 → 동의 안내', async () => {
    const { user } = renderScreen(<PushAskSheet />)
    await user.click(await screen.findByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: '알림 받기' }))
    expect(h.createPrefs).toHaveBeenCalledWith(true, expect.any(Date))
    expect(h.start).toHaveBeenCalled()
    expect(await screen.findByText(/월 \d+일 소식·혜택 알림 수신에 동의하셨어요/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '확인' }))
    expect(screen.queryByText(/동의하셨어요/)).not.toBeInTheDocument()
  })

  it('광고 체크 없이 [알림 받기]면 바로 닫힌다', async () => {
    const { user } = renderScreen(<PushAskSheet />)
    await user.click(await screen.findByRole('button', { name: '알림 받기' }))
    expect(h.createPrefs).toHaveBeenCalledWith(false, expect.any(Date))
    await waitFor(() => expect(screen.queryByText(TITLE)).not.toBeInTheDocument())
  })

  it('권한을 거부하면 저장하지 않고 7일 뒤로 미룬다', async () => {
    h.ask.mockResolvedValue(false)
    const { user } = renderScreen(<PushAskSheet />)
    await user.click(await screen.findByRole('button', { name: '알림 받기' }))
    expect(h.createPrefs).not.toHaveBeenCalled()
    expect(localStorage.getItem('pushAskedAt')).not.toBeNull()
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
  })

  it('[나중에]도 7일 뒤로 미룬다', async () => {
    const { user } = renderScreen(<PushAskSheet />)
    await user.click(await screen.findByRole('button', { name: '나중에' }))
    expect(localStorage.getItem('pushAskedAt')).not.toBeNull()
    expect(screen.queryByText(TITLE)).not.toBeInTheDocument()
  })
})
