import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const eq = vi.fn(async () => ({ error: null }))
  return {
    eq,
    update: vi.fn(() => ({ eq })),
    upsert: vi.fn(async () => ({ error: null })),
    stored: {
      reminder_on: true,
      reminder_time: '21:00:00',
      settle_on: true,
      news_on: true,
      promo_on: true,
      promo_consent_at: '2026-11-04T01:00:00.000Z',
    } as Record<string, unknown> | null,
    rpc: vi.fn(async () => ({ error: null })),
  }
})
vi.mock('./supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
    from: vi.fn(() => ({
      update: h.update,
      upsert: h.upsert,
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: h.stored, error: null }) }) }),
    })),
    rpc: h.rpc,
  },
}))

import {
  TIME_SLOTS,
  consentNotice,
  createPrefs,
  deleteMyPushData,
  firstConsentText,
  markAsked,
  readAskedAt,
  registerToken,
  setPromo,
  shouldAskPush,
} from './pushPrefs'

beforeEach(() => {
  localStorage.clear()
  h.stored = {
    reminder_on: true,
    reminder_time: '21:00:00',
    settle_on: true,
    news_on: true,
    promo_on: true,
    promo_consent_at: '2026-11-04T01:00:00.000Z',
  }
})

describe('처음 안내 7일 규칙', () => {
  const now = new Date('2026-11-10T12:00:00+09:00')
  it('물어본 적 없으면 묻는다', () => expect(shouldAskPush(null, now)).toBe(true))
  it('3일 전에 물었으면 안 묻는다', () => expect(shouldAskPush('2026-11-07T12:00:00+09:00', now)).toBe(false))
  it('7일이 지나면 다시 묻는다', () => expect(shouldAskPush('2026-11-03T12:00:00+09:00', now)).toBe(true))
  it('기록을 남기고 읽는다', () => {
    markAsked(now)
    expect(readAskedAt()).toBe(now.toISOString())
  })
})

describe('동의 안내 문구 (한국 날짜)', () => {
  const at = new Date('2026-11-04T15:30:00Z') // 한국 11월 5일 00:30
  it('처리 결과 안내', () => {
    expect(consentNotice(true, at)).toBe('2026년 11월 5일 수신 동의가 처리됐어요')
    expect(consentNotice(false, at)).toBe('2026년 11월 5일 수신 거부가 처리됐어요')
  })
  it('처음 안내에서 동의', () => {
    expect(firstConsentText(at)).toBe('11월 5일 소식·혜택 알림 수신에 동의하셨어요')
  })
})

describe('TIME_SLOTS', () => {
  it('30분 단위 48칸', () => {
    expect(TIME_SLOTS).toHaveLength(48)
    expect(TIME_SLOTS.slice(0, 3)).toEqual(['00:00', '00:30', '01:00'])
    expect(TIME_SLOTS).toContain('21:00')
    expect(TIME_SLOTS.at(-1)).toBe('23:30')
  })
})

describe('DB', () => {
  const now = new Date('2026-11-04T10:00:00+09:00')
  it('처음 켤 때 기본값으로 만든다 (광고는 체크했을 때만 동의 시각과 함께)', async () => {
    const p = await createPrefs(true, now)
    // 저장된 행을 다시 읽어 돌려준다(동의 시각은 서버 트리거가 찍은 값)
    expect(p).toEqual({
      reminderOn: true,
      reminderTime: '21:00',
      settleOn: true,
      newsOn: true,
      promoOn: true,
      promoConsentAt: '2026-11-04T01:00:00.000Z',
    })
    expect(h.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', promo_on: true, promo_consent_at: now.toISOString(), promo_reconfirm_sent_at: null }),
      { onConflict: 'user_id', ignoreDuplicates: true },
    )
  })
  it('이미 설정이 있으면 덮어쓰지 않는다 (ignoreDuplicates) — 저장된 값을 그대로 돌려준다', async () => {
    h.stored = { ...(h.stored as object), promo_on: false, promo_consent_at: null, news_on: false }
    const p = await createPrefs(true, now)
    expect(h.upsert).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ ignoreDuplicates: true }))
    expect(p.newsOn).toBe(false)
    expect(p.promoOn).toBe(false)
  })
  it('저장 뒤 다시 읽어도 없으면 실패로 본다', async () => {
    h.stored = null
    await expect(createPrefs(false, now)).rejects.toThrow()
  })
  it('탈퇴 때 푸시 데이터는 RPC 한 번으로 지운다', async () => {
    await deleteMyPushData()
    expect(h.rpc).toHaveBeenCalledWith('delete_my_push_data')
  })
  it('광고 켜기는 동의 시각을 새로 남기고 재확인 기록을 지운다', async () => {
    await setPromo(true, now)
    expect(h.update).toHaveBeenCalledWith(
      expect.objectContaining({ promo_on: true, promo_consent_at: now.toISOString(), promo_reconfirm_sent_at: null }),
    )
    await setPromo(false, now)
    expect(h.update).toHaveBeenLastCalledWith(expect.objectContaining({ promo_on: false }))
    expect(h.eq).toHaveBeenCalledWith('user_id', 'u1')
  })
  it('토큰은 RPC로 등록한다', async () => {
    await registerToken('tok-123')
    expect(h.rpc).toHaveBeenCalledWith('register_push_token', { p_token: 'tok-123', p_platform: 'android' })
  })
})
