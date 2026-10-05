import { describe, expect, it } from 'vitest'
import { kakaoText, linkify, parsePasted } from './posts'

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
    expect(kakaoText('글', true)).toContain('https://moabuli.com/info')
  })
})
