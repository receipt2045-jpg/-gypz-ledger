import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NotificationSettings from './NotificationSettings'
import type { NotificationPrefs } from '../lib/pushPrefs'

const h = vi.hoisted(() => ({
  native: true,
  supported: true,
  perm: vi.fn(),
  ask: vi.fn(),
  start: vi.fn(),
  fetchPrefs: vi.fn(),
  createPrefs: vi.fn(),
  updatePrefs: vi.fn(),
  setPromo: vi.fn(),
}))
vi.mock('../lib/native', () => ({ isNative: () => h.native }))
vi.mock('../lib/pushNative', () => ({
  pushSupported: () => h.supported,
  pushPermission: () => h.perm(),
  askPushPermission: () => h.ask(),
  startPush: () => h.start(),
}))
vi.mock('../lib/pushPrefs', async (orig) => ({
  ...(await orig<typeof import('../lib/pushPrefs')>()),
  fetchPrefs: () => h.fetchPrefs(),
  createPrefs: (p: boolean, n: Date) => h.createPrefs(p, n),
  updatePrefs: (p: unknown) => h.updatePrefs(p),
  setPromo: (on: boolean, n: Date) => h.setPromo(on, n),
}))

const PREFS: NotificationPrefs = {
  reminderOn: true,
  reminderTime: '21:00',
  settleOn: true,
  newsOn: true,
  promoOn: false,
  promoConsentAt: null,
}

beforeEach(() => {
  h.native = true
  h.supported = true
  h.perm.mockResolvedValue('granted')
  h.ask.mockResolvedValue(true)
  h.start.mockResolvedValue(undefined)
  h.fetchPrefs.mockResolvedValue({ ...PREFS })
  h.createPrefs.mockResolvedValue({ ...PREFS })
  h.updatePrefs.mockResolvedValue(undefined)
  h.setPromo.mockResolvedValue(undefined)
})

describe('설정 > 알림', () => {
  it('웹에선 안내 한 줄만', () => {
    h.native = false
    render(<NotificationSettings />)
    expect(screen.getByText('알림은 모아불리 앱에서 받을 수 있어요')).toBeInTheDocument()
    expect(h.perm).not.toHaveBeenCalled()
  })

  it('플러그인 없는 옛 앱은 업데이트 안내', () => {
    h.supported = false
    render(<NotificationSettings />)
    expect(screen.getByText('앱을 업데이트하면 알림을 받을 수 있어요')).toBeInTheDocument()
  })

  it('폰에서 막혀 있으면 알리고, 다시 거부되면 켜는 곳을 알려 준다', async () => {
    h.perm.mockResolvedValue('denied')
    h.ask.mockResolvedValue(false)
    render(<NotificationSettings />)
    expect(await screen.findByText('폰 설정에서 알림이 꺼져 있어요')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '알림 켜기' }))
    expect(await screen.findByText('폰 설정 > 애플리케이션 > 모아불리 > 알림에서 켜 주세요')).toBeInTheDocument()
  })

  it('아직 안 켠 사람은 [알림 켜기]로 기본값을 만들고 스위치가 보인다', async () => {
    h.perm.mockResolvedValue('prompt')
    h.fetchPrefs.mockResolvedValue(null)
    render(<NotificationSettings />)
    await userEvent.click(await screen.findByRole('button', { name: '알림 켜기' }))
    expect(h.createPrefs).toHaveBeenCalledWith(false, expect.any(Date))
    expect(h.start).toHaveBeenCalled()
    expect(await screen.findByRole('switch', { name: '기록 리마인더' })).toBeChecked()
  })

  it('종류별 스위치와 리마인더 시각(30분 단위)', async () => {
    render(<NotificationSettings />)
    const reminder = await screen.findByRole('switch', { name: '기록 리마인더' })
    expect(screen.getByRole('switch', { name: '월말 정산' })).toBeChecked()
    expect(screen.getByRole('switch', { name: '오늘의 경제·공지' })).toBeChecked()
    expect(screen.getByRole('switch', { name: '결영이네 소식·혜택 (광고)' })).not.toBeChecked()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: '리마인더 시각' }), '07:30')
    expect(h.updatePrefs).toHaveBeenCalledWith({ reminderTime: '07:30' })
    expect(screen.getAllByRole('option')).toHaveLength(48)

    await userEvent.click(reminder)
    expect(h.updatePrefs).toHaveBeenLastCalledWith({ reminderOn: false })
    expect(screen.getByRole('combobox', { name: '리마인더 시각' })).toBeDisabled()
  })

  it('광고 켜기·끄기는 바로 처리 결과를 알려 준다', async () => {
    render(<NotificationSettings />)
    const promo = await screen.findByRole('switch', { name: '결영이네 소식·혜택 (광고)' })
    await userEvent.click(promo)
    expect(h.setPromo).toHaveBeenCalledWith(true, expect.any(Date))
    expect(await screen.findByText(/^\d{4}년 \d+월 \d+일 수신 동의가 처리됐어요$/)).toBeInTheDocument()
    await userEvent.click(promo)
    expect(h.setPromo).toHaveBeenLastCalledWith(false, expect.any(Date))
    expect(await screen.findByText(/수신 거부가 처리됐어요$/)).toBeInTheDocument()
  })

  it('설정을 못 읽으면 켜기 카드 대신 오류를 보여 준다 (있는 설정을 덮어쓰지 않게)', async () => {
    h.fetchPrefs.mockRejectedValue(new Error('network'))
    render(<NotificationSettings />)
    expect(await screen.findByText('알림 설정을 불러오지 못했어요. 잠시 후 다시 열어 주세요.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '알림 켜기' })).not.toBeInTheDocument()
    expect(h.createPrefs).not.toHaveBeenCalled()
  })

  it('설정이 있는데 폰 알림이 꺼져 있어도 광고 동의 스위치로 철회할 수 있다', async () => {
    h.perm.mockResolvedValue('denied')
    h.fetchPrefs.mockResolvedValue({ ...PREFS, promoOn: true, promoConsentAt: '2026-11-04T01:00:00.000Z' })
    render(<NotificationSettings />)
    expect(await screen.findByText('폰 설정에서 알림이 꺼져 있어요')).toBeInTheDocument()
    const promo = screen.getByRole('switch', { name: '결영이네 소식·혜택 (광고)' })
    expect(promo).toBeChecked()
    await userEvent.click(promo)
    expect(h.setPromo).toHaveBeenCalledWith(false, expect.any(Date))
    expect(await screen.findByText(/수신 거부가 처리됐어요$/)).toBeInTheDocument()
  })

  it('저장에 실패하면 되돌린다', async () => {
    h.updatePrefs.mockRejectedValue(new Error('x'))
    render(<NotificationSettings />)
    const settle = await screen.findByRole('switch', { name: '월말 정산' })
    await userEvent.click(settle)
    expect(await screen.findByText('바꾸지 못했어요. 잠시 후 다시 해 주세요')).toBeInTheDocument()
    await waitFor(() => expect(settle).toBeChecked())
  })
})
