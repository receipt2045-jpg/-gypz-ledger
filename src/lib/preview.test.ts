import { afterEach, describe, expect, it } from 'vitest'
import { rememberLogin, startsAtLogin } from './preview'

describe('로그인 전 둘러보기 — 어디서 시작하나 (2026-10-23)', () => {
  afterEach(() => {
    localStorage.clear()
    window.location.hash = ''
  })

  it('처음 온 사람은 예시부터', () => {
    expect(startsAtLogin()).toBe(false)
  })

  it('시작하기·로그인을 해 본 기기는 로그인부터, 예시로 돌아가면 다시 예시부터', () => {
    rememberLogin(true)
    expect(startsAtLogin()).toBe(true)
    rememberLogin(false)
    expect(startsAtLogin()).toBe(false)
  })

  it('초대 링크로 오면 바로 로그인', () => {
    window.location.hash = '#/join/ABCD1234'
    expect(startsAtLogin()).toBe(true)
  })
})
