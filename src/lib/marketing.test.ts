import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'

const updateUser = vi.fn()
vi.mock('./supabase', () => ({ supabase: { auth: { updateUser: (a: unknown) => updateUser(a) } } }))

const { applyMarketingChoice, marketingConsentOf, setMarketingConsent, stashMarketingChoice } =
  await import('./marketing')

const userWith = (meta: Record<string, unknown>) => ({ user_metadata: meta }) as unknown as User

beforeEach(() => {
  localStorage.clear()
  updateUser.mockReset()
  updateUser.mockResolvedValue({ error: null })
})

describe('동의 상태 읽기', () => {
  it('동의한 계정만 true', () => {
    expect(marketingConsentOf(userWith({ marketingOptIn: true }))).toBe(true)
    expect(marketingConsentOf(userWith({ marketingOptIn: false }))).toBe(false)
    expect(marketingConsentOf(userWith({}))).toBe(false)
    expect(marketingConsentOf(null)).toBe(false)
  })
})

describe('동의/철회 기록', () => {
  it('동의하면 받은 시각을 남긴다 — 나중에 증빙이 된다', async () => {
    await setMarketingConsent(true)
    const sent = updateUser.mock.calls[0][0].data
    expect(sent.marketingOptIn).toBe(true)
    expect(typeof sent.marketingOptInAt).toBe('string')
  })

  it('철회하면 철회 시각을 남긴다', async () => {
    await setMarketingConsent(false)
    const sent = updateUser.mock.calls[0][0].data
    expect(sent.marketingOptIn).toBe(false)
    expect(typeof sent.marketingOptOutAt).toBe('string')
    expect(sent.marketingOptInAt).toBeUndefined()
  })
})

describe('구글 로그인을 다녀와도 선택이 남는다', () => {
  it('켜고 갔으면 켜진 채로 계정에 기록된다', async () => {
    stashMarketingChoice(true)
    await applyMarketingChoice(userWith({}))
    expect(updateUser.mock.calls[0][0].data.marketingOptIn).toBe(true)
  })

  it('끄고 갔으면 꺼진 채로 기록된다', async () => {
    stashMarketingChoice(false)
    await applyMarketingChoice(userWith({}))
    expect(updateUser.mock.calls[0][0].data.marketingOptIn).toBe(false)
  })

  it('한 번 옮기고 나면 다시 쓰지 않는다', async () => {
    stashMarketingChoice(true)
    await applyMarketingChoice(userWith({}))
    updateUser.mockClear()

    await applyMarketingChoice(userWith({}))
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('설정에서 끈 사람은 다시 로그인해도 몰래 켜지지 않는다', async () => {
    stashMarketingChoice(true) // 예전에 가입 화면에서 켰던 흔적이 남아 있어도
    await applyMarketingChoice(userWith({ marketingOptIn: false }))
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('맡겨둔 값이 없으면 아무것도 안 한다', async () => {
    await applyMarketingChoice(userWith({}))
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('기록에 실패해도 로그인을 막지 않는다', async () => {
    updateUser.mockResolvedValue({ error: new Error('network') })
    stashMarketingChoice(true)
    await expect(applyMarketingChoice(userWith({}))).resolves.toBeUndefined()
  })
})
