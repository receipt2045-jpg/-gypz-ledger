import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES, findCategoryGroup } from './constants'
import type { Categories } from '../types'

const cats: Categories = DEFAULT_CATEGORIES

describe('findCategoryGroup — 이름이 다른 그룹에 있는지', () => {
  // 실제 제보: '부수입'(수입)이 고정지출·변동지출에도 등록돼
  // 스텝마다 항목이 갈라졌고, 한쪽을 지워도 다른 쪽에 남아 "안 지워진다"로 보였다.
  it('수입 이름을 고정지출에 넣으려 하면 원래 그룹을 알려준다', () => {
    expect(findCategoryGroup(cats, '부수입', 'fixed')).toBe('income')
  })

  it('수입 이름을 변동지출에 넣으려 할 때도 잡는다', () => {
    expect(findCategoryGroup(cats, '부수입', 'variable')).toBe('income')
  })

  it('자기 그룹에 이미 있는 건 여기서 걸지 않는다 (그룹 내 중복은 따로 처리)', () => {
    expect(findCategoryGroup(cats, '부수입', 'income')).toBeNull()
  })

  it('새 이름은 통과', () => {
    expect(findCategoryGroup(cats, '고양이', 'variable')).toBeNull()
  })

  it("'기타'는 모든 그룹에 있는 기본값이라 예외", () => {
    expect(findCategoryGroup(cats, '기타', 'fixed')).toBeNull()
  })

  it('앞뒤 공백은 무시하고 비교한다', () => {
    expect(findCategoryGroup(cats, '  부수입  ', 'fixed')).toBe('income')
  })

  it('빈 이름은 null', () => {
    expect(findCategoryGroup(cats, '   ', 'fixed')).toBeNull()
  })

  it('저축 이름을 투자에 넣으려 해도 잡힌다', () => {
    expect(findCategoryGroup(cats, '적금', 'investment')).toBe('saving')
  })
})
