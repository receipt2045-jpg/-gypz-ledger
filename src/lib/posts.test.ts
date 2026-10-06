import { describe, expect, it } from 'vitest'
import { kakaoText, linkify, parsePasted, stripCommand } from './posts'

const NEWS = `[결영이네] 10월 2일
오늘의 경제 뉴스

🔰 오늘 딱 하나만 읽는다면
부동산 3번 뉴스

■ 주식
1. 美국채 금리 따라 등락 반복한 뉴욕증시
https://n.news.naver.com/mnews/article/001/0016352281`

describe('톡방 글 붙여넣기 → 날짜·제목·종류·본문', () => {
  const today = new Date(2026, 9, 5)

  it('첫 줄에서 날짜, 둘째 줄에서 제목', () => {
    const d = parsePasted(NEWS, today)
    expect(d.postDate).toBe('2026-10-02')
    expect(d.title).toBe('오늘의 경제 뉴스')
    expect(d.kind).toBe('news')
    expect(d.body.startsWith('🔰 오늘 딱 하나만 읽는다면')).toBe(true)
  })

  it("제목에 '증시'가 있으면 증시 정리", () => {
    const d = parsePasted('[결영이네] 10월 2일\n미국 증시 마감 정리\n\n🔰 한 줄 정리', today)
    expect(d.kind).toBe('market')
  })

  it('날짜 줄이 없으면 오늘, 첫 줄이 제목', () => {
    const d = parsePasted('오늘의 경제 뉴스\n본문', today)
    expect(d.postDate).toBe('2026-10-05')
    expect(d.title).toBe('오늘의 경제 뉴스')
    expect(d.body).toBe('본문')
  })

  it('1월에 붙여넣은 12월 글은 작년', () => {
    const d = parsePasted('[결영이네] 12월 31일\n오늘의 경제 뉴스\n본문', new Date(2027, 0, 1))
    expect(d.postDate).toBe('2026-12-31')
  })
})

describe('본문 링크', () => {
  it('기사 주소만 링크로 뽑는다', () => {
    const segs = linkify('읽어보세요 https://n.news.naver.com/a/1 끝')
    expect(segs).toEqual([
      { type: 'text', text: '읽어보세요 ' },
      { type: 'link', href: 'https://n.news.naver.com/a/1' },
      { type: 'text', text: ' 끝' },
    ])
  })
})

describe('톡방에도 보내기', () => {
  it('원문 그대로 + 원하면 앱 링크 한 줄', () => {
    expect(kakaoText(' 글 ', false)).toBe('글')
    expect(kakaoText('글', true)).toContain('https://moabuli.com/news')
  })
})

describe('부탁 한 줄은 글에서 뺀다 (2026-10-06 제보)', () => {
  it('끝에 붙인 "이렇게 바꿔서 올려"는 빠진다', () => {
    const d = parsePasted(
      '[결영이네] 10월 6일\n오늘의 경제 뉴스\n\n본문 첫 줄\n본문 둘째 줄\n\n이렇게 바꿔서 올려',
      new Date(2026, 9, 6),
    )
    expect(d.body).toBe('본문 첫 줄\n본문 둘째 줄')
  })

  it('맨 앞의 "올려줘"도 빠진다', () => {
    expect(stripCommand('올려줘\n[결영이네] 10월 6일\n제목\n본문')).toBe(
      '[결영이네] 10월 6일\n제목\n본문',
    )
  })

  it('본문 속 평범한 문장은 그대로', () => {
    expect(stripCommand('제목\n금리를 올려요')).toBe('제목\n금리를 올려요')
    expect(stripCommand('제목\n중앙은행이 기준금리를 크게 올려서 시장이 놀랐어요 올려')).toContain(
      '놀랐어요',
    )
  })
})

describe('날짜 줄 — [결영이네]가 없어도 (루틴 원문)', () => {
  it('"10월 6일"만 있어도 날짜로 읽는다', () => {
    const d = parsePasted('10월 6일\n오늘의 경제 뉴스\n\n본문', new Date(2026, 9, 6))
    expect(d.postDate).toBe('2026-10-06')
    expect(d.title).toBe('오늘의 경제 뉴스')
  })
  it('날짜 뒤에 다른 말이 붙은 줄은 날짜 줄이 아니다', () => {
    const d = parsePasted('10월 6일 오늘의 경제 뉴스\n본문', new Date(2026, 9, 6))
    expect(d.title).toBe('10월 6일 오늘의 경제 뉴스')
  })
})

describe('부부방 글 끝 앱 링크는 본문에 넣지 않는다', () => {
  it('📱 줄과 moabuli.com/news 주소가 빠진다', () => {
    const d = parsePasted(
      '[결영이네] 10월 6일\n오늘의 경제 뉴스\n\n본문 한 줄\n\n📱 지난 글은 모아불리에서 모아 봐요\nhttps://moabuli.com/news',
      new Date(2026, 9, 6),
    )
    expect(d.body).toBe('본문 한 줄')
  })
  it('카톡용 글에 링크가 두 번 붙지 않는다', () => {
    const once = kakaoText('글', true)
    expect(kakaoText(stripCommand(once), true)).toBe(once)
  })
})
