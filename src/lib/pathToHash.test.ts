import { describe, expect, it } from 'vitest'
import { hashFromPath } from './pathToHash'

describe('해시 없이 들어온 주소 — 링크 서비스가 #을 떼거나 바꿔도 계산기가 뜬다', () => {
  it('/leave → /#/leave', () => {
    expect(hashFromPath('/leave', '', '')).toBe('/#/leave')
  })

  it('#이 %23으로 바뀐 주소', () => {
    expect(hashFromPath('/%23/leave', '', '')).toBe('/#/leave')
  })

  it('공유 숫자(?s=)도 그대로 따라간다', () => {
    expect(hashFromPath('/%23/leave', '?s=abc', '')).toBe('/#/leave?s=abc')
    expect(hashFromPath('/%23/leave%3Fs%3Dabc', '', '')).toBe('/#/leave?s=abc')
    expect(hashFromPath('/leave', '?s=abc', '')).toBe('/#/leave?s=abc')
  })

  it('이미 해시가 있거나 첫 화면이면 건드리지 않는다', () => {
    expect(hashFromPath('/', '', '#/leave')).toBeNull()
    expect(hashFromPath('/', '', '')).toBeNull()
    expect(hashFromPath('/index.html', '', '')).toBeNull()
    expect(hashFromPath('/', '?code=x', '')).toBeNull() // 로그인 돌아오는 주소
  })
})
