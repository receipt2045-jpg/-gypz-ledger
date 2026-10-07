import { describe, expect, it } from 'vitest'
import { evaluate, isExpr } from './calc'

describe('금액 칸 계산기', () => {
  it('더하기·빼기·곱하기·나누기, 곱셈 먼저', () => {
    expect(evaluate('38000+12500+9900')).toBe(60400)
    expect(evaluate('100000-35000')).toBe(65000)
    expect(evaluate('12500×2+3000')).toBe(28000)
    expect(evaluate('1200000÷3')).toBe(400000)
    expect(evaluate('(1000+2000)*2')).toBe(6000)
  })

  it('콤마·공백·원·화면 기호(−)를 읽는다', () => {
    expect(evaluate('38,000 + 12,500원')).toBe(50500)
    expect(evaluate('50,000 − 12,000')).toBe(38000)
  })

  it('덜 끝난 식, 0으로 나누기, 다른 글자는 null', () => {
    expect(evaluate('38000+')).toBeNull()
    expect(evaluate('100/0')).toBeNull()
    expect(evaluate('alert(1)')).toBeNull()
  })

  it('나눠 떨어지지 않으면 원 단위로 반올림', () => {
    expect(evaluate('100000/3')).toBe(33333)
  })

  it('연산 기호가 있어야 식으로 본다', () => {
    expect(isExpr('38,000')).toBe(false)
    expect(isExpr('38000+1')).toBe(true)
    expect(isExpr('5000×2')).toBe(true)
  })
})
