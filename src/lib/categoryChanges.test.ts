import { describe, expect, it } from 'vitest'
import { applyCategoryChanges, changesFromSnapshot } from './categoryChanges'
import { DEFAULT_CATEGORIES } from './constants'
import type { Categories } from '../types'

const base: Categories = {
  ...DEFAULT_CATEGORIES,
  variable: ['식비', '외식'],
}

describe('카테고리 — 바뀐 것만 서버 최신 목록에 얹는다', () => {
  it('배우자가 그 사이 추가한 것은 지우지 않는다', () => {
    const server = { ...base, variable: ['식비', '외식', '아기용품'] } // 배우자가 추가
    const merged = applyCategoryChanges(server, [
      { action: 'add', group: 'variable', name: '반려동물' },
    ])
    expect(merged.variable).toEqual(['식비', '외식', '아기용품', '반려동물'])
  })

  it('삭제도 그 이름만 뺀다', () => {
    const server = { ...base, variable: ['식비', '외식', '아기용품'] }
    const merged = applyCategoryChanges(server, [
      { action: 'remove', group: 'variable', name: '외식' },
    ])
    expect(merged.variable).toEqual(['식비', '아기용품'])
  })

  it('같은 그룹에 이미 있거나 다른 그룹에 같은 이름이 있으면 넣지 않는다', () => {
    const name = base.income[0]
    expect(applyCategoryChanges(base, [{ action: 'add', group: 'variable', name: '식비' }])).toBe(
      base,
    )
    expect(
      applyCategoryChanges(base, [{ action: 'add', group: 'variable', name }]).variable,
    ).toEqual(['식비', '외식'])
  })

  it('예전 재시도 큐의 목록 통째 저장은 빠진 것만 더한다', () => {
    const server = { ...base, variable: ['식비', '아기용품'] }
    const merged = applyCategoryChanges(
      server,
      changesFromSnapshot({ ...base, variable: ['식비', '외식'] }),
    )
    expect(merged.variable).toEqual(['식비', '아기용품', '외식'])
  })
})
