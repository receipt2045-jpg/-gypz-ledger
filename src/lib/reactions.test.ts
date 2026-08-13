import { beforeEach, describe, expect, it } from 'vitest'
import { pickReaction } from './reactions'
import type { Confession } from '../types'

const confess = (category: string, amount: number, kind: Confession['kind'] = 'variable') => ({
  category,
  kind,
  amount,
})

beforeEach(() => localStorage.clear())

describe('고백 반응 — 같은 말이 반복되지 않는다', () => {
  it('연달아 기록해도 매번 다른 말이 나온다', () => {
    // 예전엔 후보가 2개뿐인 카테고리가 A→B→A→B로 딱 번갈아 나왔다
    const seen = new Set<string>()
    for (let i = 0; i < 4; i += 1) {
      const r = pickReaction(confess('통신비', 80_000, 'fixed'))
      seen.add(r.bubbles[0].text)
    }
    expect(seen.size).toBe(4)
  })

  it('바로 앞에 나온 말이 다시 나오지 않는다', () => {
    let prev = ''
    for (let i = 0; i < 12; i += 1) {
      const r = pickReaction(confess('카페', 5_000))
      expect(r.bubbles[0].text).not.toBe(prev)
      prev = r.bubbles[0].text
    }
  })
})

describe('고백 반응 — AI 티가 나는 요소가 없다', () => {
  const CATEGORIES = ['구독', '통신비', '배달', '카페', '택시', '쇼핑', '식비', '술']

  it('잔소리 대사에 이모지를 쓰지 않는다', () => {
    const emoji = /\p{Extended_Pictographic}/u
    for (const cat of CATEGORIES) {
      for (let i = 0; i < 8; i += 1) {
        const r = pickReaction(confess(cat, 12_000))
        for (const b of r.bubbles) {
          expect(b.text, `${cat}: ${b.text}`).not.toMatch(emoji)
        }
      }
    }
  })

  it('실행 버튼 문구에 화살표 기호를 넣지 않는다 (화면에 이미 있다)', () => {
    const r = pickReaction(confess('구독', 12_000))
    expect(r.action).toBeTruthy()
    expect(r.action).not.toContain('👉')
  })
})

describe('고백 반응 — 숫자를 억지로 부풀리지 않는다', () => {
  it('한 번 넣은 저축을 10년 곱해서 말하지 않는다', () => {
    const r = pickReaction(confess('예금', 300_000, 'saving'))
    const text = r.bubbles[0].text
    // 10년 환산을 쓸 거면 '매달'이라는 전제를 반드시 같이 말해야 한다
    if (text.includes('10년')) expect(text).toContain('매달')
  })

  it('1년 환산은 이 페이스가 이어졌을 때라는 걸 밝힌다', () => {
    const seen: string[] = []
    for (let i = 0; i < 10; i += 1) {
      seen.push(pickReaction(confess('배달', 20_000)).bubbles[1].text)
    }
    for (const t of seen) {
      if (t.includes('1년에')) expect(t).toContain('이 페이스면')
    }
  })
})
