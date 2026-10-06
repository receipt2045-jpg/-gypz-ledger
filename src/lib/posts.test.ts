import { describe, expect, it } from 'vitest'
import {
  groupByDay,
  groupByMonth,
  kakaoText,
  linkify,
  parsePasted,
  postSummary,
  stripCommand,
  type Post,
} from './posts'

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

describe('지난 글 목록 — 한 줄 정리와 달별 묶기', () => {
  it('🔰 다음 줄을 쓰고 "부동산 2번 뉴스," 앞머리는 뗀다', () => {
    expect(
      postSummary('🔰 오늘 딱 하나만 읽는다면\n부동산 2번 뉴스, 전세 매물이 말라요.\n\n■ 주식'),
    ).toBe('전세 매물이 말라요.')
    expect(postSummary('🔰 한 줄 정리\n미국 주식이 올랐어요.\n\n💌왜?')).toBe(
      '미국 주식이 올랐어요.',
    )
  })

  it('🔰가 없는 옛 형식은 기호·주소를 빼고 첫 줄', () => {
    expect(postSummary('- 다우 -0.7%, S&P500 -0.3%\n- 엔비디아 +1.5%')).toBe(
      '다우 -0.7%, S&P500 -0.3%',
    )
    expect(postSummary('■ 주식\n\n1. "코스피 7000선 박스권" https://n.news.naver.com/x')).toBe(
      '"코스피 7000선 박스권"',
    )
  })

  it('최근 달부터 묶는다', () => {
    const p = (id: string, postDate: string): Post => ({
      id,
      kind: 'news',
      title: 't',
      body: 'b',
      postDate,
      createdAt: '',
    })
    const g = groupByMonth([p('a', '2026-10-06'), p('b', '2026-09-30'), p('c', '2026-10-01')])
    expect(g.map((x) => [x.label, x.posts.map((y) => y.id).join('')])).toEqual([
      ['2026년 10월', 'ac'],
      ['2026년 9월', 'b'],
    ])
  })
})

describe('카톡에서 옮긴 글 — 한 줄 정리가 여러 줄로 끊겨 있어도', () => {
  it('빈 줄까지 이어 붙인다', () => {
    expect(
      postSummary(
        '🔰 오늘 딱 하나만 읽는다면\n부동산 3번 뉴스, 오피스텔 평균 월세도\n100만원에 육박한다는 기사에요\n\n■ 주식',
      ),
    ).toBe('오피스텔 평균 월세도 100만원에 육박한다는 기사에요')
  })

  it('날짜별로 묶고, 같은 날은 올린 순서(아침 → 저녁)', () => {
    const p = (id: string, postDate: string, createdAt: string): Post => ({
      id,
      kind: 'news',
      title: 't',
      body: 'b',
      postDate,
      createdAt,
    })
    const g = groupByDay([
      p('eve', '2026-10-01', '2026-10-01T11:10:00Z'),
      p('mor', '2026-10-01', '2026-10-01T08:18:00Z'),
      p('new', '2026-10-06', '2026-10-06T08:17:00Z'),
    ])
    expect(g.map((d) => [d.label, d.posts.map((x) => x.id).join(',')])).toEqual([
      ['10월 6일 화요일', 'new'],
      ['10월 1일 목요일', 'mor,eve'],
    ])
  })
})
