import { describe, expect, it } from 'vitest'
import { MONEYTOONS, MONEYTOON_SHARES, checkMoneyToon } from './moneytoon'
import { SHARES } from './shares'

// 머니툰 자료 json 은 서버 루틴이 만든다 — 모양이 틀리면 여기서 빌드를 막아 깨진 페이지가 안 나가게
describe('머니툰 자료', () => {
  // 자료는 모아불리 기존 기능(주식 일지 등)을 먼저 쓰고, 맞는 게 없을 때만 json 을 더한다 — 0개일 수도 있다
  it('있는 파일은 모양이 맞다', () => {
    for (const m of MONEYTOONS) expect(checkMoneyToon(m)).toEqual([])
  })
  it('slug 가 겹치지 않는다', () => {
    expect(new Set(MONEYTOONS.map((m) => m.slug)).size).toBe(MONEYTOONS.length)
  })
  it('자료 나눔 목록에 들어간다', () => {
    for (const s of MONEYTOON_SHARES) expect(SHARES.some((x) => x.path === s.path)).toBe(true)
  })
  it('틀린 모양은 잡는다', () => {
    const bad = {
      slug: '산이유', title: '표', episode: '질문?', date: '2026-11-19', emoji: '📝', lead: 'a', description: 'b',
      source: 'https://cafe.naver.com/x', sourceDate: '2026-11-13',
      blocks: [{ type: 'table', title: 't', head: ['a', 'b'], rows: [['x']] }],
    }
    expect(checkMoneyToon(bad as never).length).toBeGreaterThanOrEqual(2)
  })
})
