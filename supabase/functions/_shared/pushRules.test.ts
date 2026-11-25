import { describe, expect, it } from 'vitest'
import {
  addMonthsKst,
  inWindow,
  kstInstant,
  kstParts,
  koreanDate,
  logKey,
  planPushes,
  promoHourOk,
  promoText,
  settleTargetOn,
  shiftDate,
  type DueCampaign,
  type PushInput,
  type PushPrefs,
} from './pushRules.ts'

const at = (iso: string) => new Date(iso)

function pref(userId: string, o: Partial<PushPrefs> = {}): PushPrefs {
  return {
    userId,
    reminderOn: true,
    reminderTime: '21:00:00',
    settleOn: true,
    newsOn: true,
    promoOn: false,
    promoConsentAt: null,
    promoReconfirmSentAt: null,
    ...o,
  }
}

function input(o: Partial<PushInput> & { now: Date }): PushInput {
  return {
    prefs: [pref('u1')],
    members: { u1: { householdId: 'h1', memberNo: 1, monthStartDay: 1 } },
    confessedToday: new Set(),
    closedLedgers: new Set(),
    todayPosts: [],
    campaigns: [],
    sentLog: new Set(),
    ...o,
  }
}

const kinds = (i: PushInput) => planPushes(i).sends.map((s) => `${s.userId}:${s.kind}:${s.refKey}`)

describe('한국 시간 도우미', () => {
  it('UTC 23:30은 한국 다음 날 08:30', () => {
    expect(kstParts(at('2026-11-04T23:30:00Z'))).toMatchObject({
      date: '2026-11-05',
      ym: '2026-11',
      day: 5,
      hour: 8,
      minute: 30,
    })
  })
  it('kstInstant는 한국 시각을 UTC로', () => {
    expect(new Date(kstInstant('2026-11-05', '09:30')).toISOString()).toBe('2026-11-05T00:30:00.000Z')
  })
  it('shiftDate는 달·해를 넘긴다', () => {
    expect(shiftDate('2026-03-03', -3)).toBe('2026-02-28')
    expect(shiftDate('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('5분 창: now-5분 < t ≤ now', () => {
    const now = at('2026-11-04T21:00:00+09:00')
    const t = now.getTime()
    expect(inWindow(now, t)).toBe(true)
    expect(inWindow(now, t - 4 * 60_000 - 59_000)).toBe(true)
    expect(inWindow(now, t - 5 * 60_000)).toBe(false)
    expect(inWindow(now, t + 1000)).toBe(false)
  })
  it('광고 가능 시간은 08:00~20:59', () => {
    expect(promoHourOk(at('2026-11-04T07:59:00+09:00'))).toBe(false)
    expect(promoHourOk(at('2026-11-04T08:00:00+09:00'))).toBe(true)
    expect(promoHourOk(at('2026-11-04T20:59:00+09:00'))).toBe(true)
    expect(promoHourOk(at('2026-11-04T21:00:00+09:00'))).toBe(false)
  })
  it('koreanDate는 한국 날짜로 쓴다', () => {
    expect(koreanDate('2026-11-04T15:30:00Z')).toBe('2026년 11월 5일')
  })
  it('addMonthsKst는 한국 달력으로 더한다', () => {
    expect(new Date(addMonthsKst('2024-12-04T10:00:00+09:00', 23)).toISOString()).toBe(
      new Date('2026-11-04T10:00:00+09:00').toISOString(),
    )
  })
  it('promoText는 (광고)와 수신 거부 안내를 붙인다', () => {
    expect(promoText('연말 특강', '자리 남았어요')).toEqual({
      title: '(광고) 연말 특강',
      body: '자리 남았어요\n수신 거부: 설정 > 알림',
    })
  })
})

describe('정산일', () => {
  it('시작일 1이면 1일, 대상은 앞 달', () => {
    expect(settleTargetOn('2026-11-01', 1)).toBe('2026-10')
    expect(settleTargetOn('2026-11-02', 1)).toBeNull()
  })
  it('시작일 25면 25일, 대상은 앞 달', () => {
    expect(settleTargetOn('2026-11-25', 25)).toBe('2026-10')
    expect(settleTargetOn('2026-11-24', 25)).toBeNull()
  })
  it('1월 1일 정산일이면 대상은 지난해 12월', () => {
    expect(settleTargetOn('2027-01-01', 1)).toBe('2026-12')
  })
  it('시작일이 이상한 값이면 1로 본다', () => {
    expect(settleTargetOn('2026-11-01', 0)).toBe('2026-10')
    expect(settleTargetOn('2026-11-01', 31)).toBe('2026-10')
  })
})

describe('reminder', () => {
  const now = at('2026-11-04T21:00:30+09:00')
  it('시각 창 안이고 오늘 기록이 없으면 보낸다', () => {
    const plan = planPushes(input({ now }))
    expect(plan.sends).toEqual([
      {
        userId: 'u1',
        kind: 'reminder',
        refKey: '2026-11-04',
        title: '오늘 기록할 시간이에요',
        body: '쓴 돈 30초면 남겨요.',
        path: '/confess',
      },
    ])
  })
  it('오늘 내 기록이 있으면 안 보낸다', () => {
    expect(kinds(input({ now, confessedToday: new Set(['h1:1']) }))).toEqual([])
  })
  it('배우자 기록만 있으면 나는 받는다', () => {
    expect(kinds(input({ now, confessedToday: new Set(['h1:2']) }))).toEqual(['u1:reminder:2026-11-04'])
  })
  it('창을 놓치면(5분 30초 뒤) 안 보낸다', () => {
    expect(kinds(input({ now: at('2026-11-04T21:05:30+09:00') }))).toEqual([])
  })
  it('사람마다 시각이 다르다', () => {
    const i = input({ now: at('2026-11-04T07:30:10+09:00'), prefs: [pref('u1', { reminderTime: '07:30' })] })
    expect(kinds(i)).toEqual(['u1:reminder:2026-11-04'])
  })
  it('끈 사람, 집이 없는 사람은 안 받는다', () => {
    expect(kinds(input({ now, prefs: [pref('u1', { reminderOn: false })] }))).toEqual([])
    expect(kinds(input({ now, members: {} }))).toEqual([])
  })
  it('이미 보냈으면 다시 안 보낸다', () => {
    const sentLog = new Set([logKey('u1', 'reminder', '2026-11-04')])
    expect(kinds(input({ now, sentLog }))).toEqual([])
  })
})

describe('settle / settle_again', () => {
  const off = { reminderOn: false }
  it('정산일 20:00 창에 부부 둘 다 받는다', () => {
    const i = input({
      now: at('2026-11-01T20:00:20+09:00'),
      prefs: [pref('u1', off), pref('u2', off)],
      members: {
        u1: { householdId: 'h1', memberNo: 1, monthStartDay: 1 },
        u2: { householdId: 'h1', memberNo: 2, monthStartDay: 1 },
      },
    })
    const plan = planPushes(i)
    expect(plan.sends.map((s) => `${s.userId}:${s.kind}:${s.refKey}`)).toEqual([
      'u1:settle:2026-10:settle',
      'u2:settle:2026-10:settle',
    ])
    expect(plan.sends[0]).toMatchObject({ title: '이번 달 정산할 날이에요', body: '한 달 돈 흐름, 같이 맞춰봐요.', path: '/monthly' })
  })
  it('시작일 25인 집은 25일에', () => {
    const members = { u1: { householdId: 'h1', memberNo: 1 as const, monthStartDay: 25 } }
    expect(kinds(input({ now: at('2026-11-25T20:01:00+09:00'), prefs: [pref('u1', off)], members }))).toEqual([
      'u1:settle:2026-10:settle',
    ])
    expect(kinds(input({ now: at('2026-11-24T20:01:00+09:00'), prefs: [pref('u1', off)], members }))).toEqual([])
  })
  it('19:59, 20:05엔 안 보낸다', () => {
    expect(kinds(input({ now: at('2026-11-01T19:59:00+09:00'), prefs: [pref('u1', off)] }))).toEqual([])
    expect(kinds(input({ now: at('2026-11-01T20:05:00+09:00'), prefs: [pref('u1', off)] }))).toEqual([])
  })
  it('정산을 마쳤으면 안 보낸다', () => {
    const i = input({ now: at('2026-11-01T20:00:20+09:00'), prefs: [pref('u1', off)], closedLedgers: new Set(['h1:2026-10']) })
    expect(kinds(i)).toEqual([])
  })
  it('settle_on을 끈 사람은 안 받는다', () => {
    expect(kinds(input({ now: at('2026-11-01T20:00:20+09:00'), prefs: [pref('u1', { ...off, settleOn: false })] }))).toEqual([])
  })
  it('3일 뒤 20:00, 첫 알림을 보냈고 아직 안 했으면 다시', () => {
    const i = input({
      now: at('2026-11-04T20:00:00+09:00'),
      prefs: [pref('u1', off)],
      sentLog: new Set([logKey('u1', 'settle', '2026-10:settle')]),
    })
    const plan = planPushes(i)
    expect(plan.sends).toEqual([
      { userId: 'u1', kind: 'settle_again', refKey: '2026-10:again', title: '정산이 아직이에요', body: '5분이면 끝나요.', path: '/monthly' },
    ])
  })
  it('첫 알림이 없었으면 3일 뒤에도 안 보낸다', () => {
    expect(kinds(input({ now: at('2026-11-04T20:00:00+09:00'), prefs: [pref('u1', off)] }))).toEqual([])
  })
  it('3일 사이에 정산했으면 안 보낸다', () => {
    const i = input({
      now: at('2026-11-04T20:00:00+09:00'),
      prefs: [pref('u1', off)],
      sentLog: new Set([logKey('u1', 'settle', '2026-10:settle')]),
      closedLedgers: new Set(['h1:2026-10']),
    })
    expect(kinds(i)).toEqual([])
  })
  it('월말: 시작일 28이면 2월 28일 정산, 3월 3일 다시', () => {
    const members = { u1: { householdId: 'h1', memberNo: 1 as const, monthStartDay: 28 } }
    expect(kinds(input({ now: at('2026-02-28T20:00:10+09:00'), prefs: [pref('u1', off)], members }))).toEqual([
      'u1:settle:2026-01:settle',
    ])
    const again = input({
      now: at('2026-03-03T20:00:10+09:00'),
      prefs: [pref('u1', off)],
      members,
      sentLog: new Set([logKey('u1', 'settle', '2026-01:settle')]),
    })
    expect(kinds(again)).toEqual(['u1:settle_again:2026-01:again'])
  })
})

describe('news', () => {
  const now = at('2026-11-04T08:00:10+09:00')
  const posts = [
    { id: 'm1', kind: 'market' as const, title: '미국 증시 마감 정리', createdAt: '2026-11-03T22:00:00Z' },
    { id: 'n2', kind: 'news' as const, title: '오늘 볼 뉴스 둘', createdAt: '2026-11-03T22:40:00Z' },
    { id: 'n1', kind: 'news' as const, title: '금리 동결, 대출은?', createdAt: '2026-11-03T22:30:00Z' },
  ]
  it('08:00 창에 오늘 글 제목으로 보낸다 (news 먼저, 먼저 올린 글)', () => {
    const plan = planPushes(input({ now, prefs: [pref('u1', { reminderOn: false })], todayPosts: posts }))
    expect(plan.sends).toEqual([
      { userId: 'u1', kind: 'news', refKey: '2026-11-04', title: '오늘의 경제', body: '금리 동결, 대출은?', path: '/info/n1' },
    ])
  })
  it('news가 없으면 market 글', () => {
    const plan = planPushes(input({ now, todayPosts: [posts[0]] }))
    expect(plan.sends[0]).toMatchObject({ body: '미국 증시 마감 정리', path: '/info/m1' })
  })
  it('오늘 글이 없거나, 끈 사람, 07:59엔 안 보낸다', () => {
    expect(kinds(input({ now }))).toEqual([])
    expect(kinds(input({ now, todayPosts: posts, prefs: [pref('u1', { newsOn: false })] }))).toEqual([])
    expect(kinds(input({ now: at('2026-11-04T07:59:00+09:00'), todayPosts: posts }))).toEqual([])
  })
})

describe('notice / promo 캠페인', () => {
  const notice: DueCampaign = { id: 'c1', kind: 'notice', title: '새 기능', body: '정산이 쉬워졌어요', path: '/monthly', sendAt: '2026-11-04T13:58:00+09:00' }
  const promo: DueCampaign = { id: 'c2', kind: 'promo', title: '연말 특강', body: '자리 남았어요', path: '/consult', sendAt: '2026-11-04T13:58:00+09:00' }
  const people = [pref('u1', { reminderOn: false }), pref('u2', { reminderOn: false, newsOn: false, promoOn: true })]

  it('공지는 send_at 이후 첫 실행에 news_on인 사람에게', () => {
    const plan = planPushes(input({ now: at('2026-11-04T14:00:00+09:00'), prefs: people, campaigns: [notice] }))
    expect(plan.sends).toEqual([
      { userId: 'u1', kind: 'notice', refKey: 'campaign:c1', title: '새 기능', body: '정산이 쉬워졌어요', path: '/monthly', campaignId: 'c1' },
    ])
    expect(plan.campaignsDone).toEqual(['c1'])
  })
  it('공지는 밤에도 간다', () => {
    const plan = planPushes(input({ now: at('2026-11-04T22:00:00+09:00'), prefs: people, campaigns: [notice] }))
    expect(plan.campaignsDone).toEqual(['c1'])
  })
  it('send_at 전이면 아무것도 안 한다', () => {
    const plan = planPushes(input({ now: at('2026-11-04T13:50:00+09:00'), prefs: people, campaigns: [notice] }))
    expect(plan).toEqual({ sends: [], campaignsDone: [] })
  })
  it('홍보는 promo_on인 사람에게 (광고)·수신 거부를 붙여서', () => {
    const plan = planPushes(input({ now: at('2026-11-04T14:00:00+09:00'), prefs: people, campaigns: [promo] }))
    expect(plan.sends).toEqual([
      {
        userId: 'u2',
        kind: 'promo',
        refKey: 'campaign:c2',
        title: '(광고) 연말 특강',
        body: '자리 남았어요\n수신 거부: 설정 > 알림',
        path: '/consult',
        campaignId: 'c2',
      },
    ])
    expect(plan.campaignsDone).toEqual(['c2'])
  })
  it('홍보는 21~08시면 미룬다 (안 보내고 마감도 안 함)', () => {
    for (const t of ['2026-11-04T21:10:00+09:00', '2026-11-05T07:55:00+09:00']) {
      expect(planPushes(input({ now: at(t), prefs: people, campaigns: [promo] }))).toEqual({ sends: [], campaignsDone: [] })
    }
    expect(planPushes(input({ now: at('2026-11-05T08:00:05+09:00'), prefs: people, campaigns: [promo] })).campaignsDone).toEqual(['c2'])
  })
  it('받을 사람이 없어도 캠페인은 마감한다', () => {
    const plan = planPushes(input({ now: at('2026-11-04T14:00:00+09:00'), prefs: [pref('u3', { newsOn: false })], campaigns: [notice] }))
    expect(plan).toEqual({ sends: [], campaignsDone: ['c1'] })
  })
  it('이미 보낸 사람은 건너뛴다', () => {
    const plan = planPushes(
      input({ now: at('2026-11-04T14:00:00+09:00'), prefs: people, campaigns: [notice], sentLog: new Set([logKey('u1', 'notice', 'campaign:c1')]) }),
    )
    expect(plan.sends).toEqual([])
  })
})

describe('promo_reconfirm (2년마다 동의 재확인)', () => {
  const p = pref('u1', { reminderOn: false, promoOn: true, promoConsentAt: '2024-12-04T10:00:00+09:00' })
  it('동의 후 23개월이 지난 첫 실행(광고 가능 시간)에 보낸다', () => {
    const plan = planPushes(input({ now: at('2026-11-04T10:00:00+09:00'), prefs: [p] }))
    expect(plan.sends).toEqual([
      {
        userId: 'u1',
        kind: 'promo_reconfirm',
        refKey: 'reconfirm:2026-11',
        title: '소식·혜택 알림 수신 동의 안내',
        body: '2024년 12월 4일에 동의하셨어요. 계속 받으시려면 따로 하실 건 없어요. 그만 받으려면 설정 > 알림에서 꺼 주세요.',
        path: '/settings',
      },
    ])
  })
  it('23개월 전이면 안 보낸다', () => {
    expect(kinds(input({ now: at('2026-11-04T09:55:00+09:00'), prefs: [p] }))).toEqual([])
  })
  it('밤이면 다음 날 아침으로 미룬다', () => {
    expect(kinds(input({ now: at('2026-11-04T22:00:00+09:00'), prefs: [p] }))).toEqual([])
    expect(kinds(input({ now: at('2026-11-05T08:00:00+09:00'), prefs: [p] }))).toEqual(['u1:promo_reconfirm:reconfirm:2026-11'])
  })
  it('재확인을 보낸 뒤엔 그때부터 다시 23개월', () => {
    const sent = { ...p, promoReconfirmSentAt: '2026-11-04T10:00:00+09:00' }
    expect(kinds(input({ now: at('2026-12-01T10:00:00+09:00'), prefs: [sent] }))).toEqual([])
    expect(kinds(input({ now: at('2028-10-04T10:00:00+09:00'), prefs: [sent] }))).toEqual(['u1:promo_reconfirm:reconfirm:2028-10'])
  })
  it('광고를 끈 사람, 동의 기록이 없는 사람은 안 받는다', () => {
    expect(kinds(input({ now: at('2026-11-04T10:00:00+09:00'), prefs: [{ ...p, promoOn: false }] }))).toEqual([])
    expect(kinds(input({ now: at('2026-11-04T10:00:00+09:00'), prefs: [{ ...p, promoConsentAt: null }] }))).toEqual([])
  })
})
