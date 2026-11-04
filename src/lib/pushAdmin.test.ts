import { describe, expect, it } from 'vitest'
import { kstSendAt, previewText, promoTimeAllowed, scheduleError, sendAtLabel, timeSlotsFor } from './pushAdmin'

describe('광고 미리보기', () => {
  it('홍보는 (광고)와 수신 거부를 붙이고, 공지는 그대로', () => {
    expect(previewText('promo', '연말 특강', '자리 남았어요')).toEqual({
      title: '(광고) 연말 특강',
      body: '자리 남았어요\n수신 거부: 설정 > 알림',
    })
    expect(previewText('notice', '새 기능', '정산이 쉬워졌어요')).toEqual({ title: '새 기능', body: '정산이 쉬워졌어요' })
  })
})

describe('예약 시각', () => {
  const now = new Date('2026-11-04T12:00:00+09:00')
  it('홍보는 08:00~20:30만 고를 수 있다', () => {
    const slots = timeSlotsFor('promo')
    expect(slots[0]).toBe('08:00')
    expect(slots.at(-1)).toBe('20:30')
    expect(slots).toHaveLength(26)
    expect(slots).not.toContain('21:00')
    expect(slots).not.toContain('07:30')
    expect(timeSlotsFor('notice')).toHaveLength(48)
    expect(promoTimeAllowed('20:59')).toBe(true)
    expect(promoTimeAllowed('21:00')).toBe(false)
  })
  it('한국 시각으로 저장한다', () => {
    expect(kstSendAt('2026-11-05', '09:30')).toBe('2026-11-05T00:30:00.000Z')
    expect(sendAtLabel('2026-11-05T00:30:00.000Z')).toBe('11/5 09:30')
  })
  it('검사', () => {
    expect(scheduleError('notice', '', '', now)).toBe('날짜와 시각을 골라 주세요')
    expect(scheduleError('promo', '2026-11-05', '21:00', now)).toBe('광고 알림은 밤 9시부터 아침 8시까지 보낼 수 없어요')
    expect(scheduleError('notice', '2026-11-04', '11:30', now)).toBe('지난 시각은 고를 수 없어요')
    expect(scheduleError('notice', '2026-11-04', '22:00', now)).toBeNull()
    expect(scheduleError('promo', '2026-11-05', '08:00', now)).toBeNull()
  })
})
