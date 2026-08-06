import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from './constants'
import { extractAmount, parseConfessionText } from './confessParser'

const cats = DEFAULT_CATEGORIES

describe('extractAmount — 금액 표기', () => {
  it('쉼표 숫자: 12,000원', () => {
    expect(extractAmount('택시 12,000원')).toEqual({ amount: 12_000, rest: '택시' })
  })
  it('천 단위: 9천원', () => {
    expect(extractAmount('김밥 9천원')?.amount).toBe(9_000)
  })
  it('만+천 조합: 1만2천', () => {
    expect(extractAmount('숙소 1만2천')?.amount).toBe(12_000)
  })
  it('만 단독: 3만', () => {
    expect(extractAmount('치킨 3만')?.amount).toBe(30_000)
  })
  it('단위어 단독: 만원', () => {
    expect(extractAmount('커피 만원')?.amount).toBe(10_000)
  })
  it('소수 조합: 1.5만', () => {
    expect(extractAmount('회식 1.5만')?.amount).toBe(15_000)
  })
  it('원 붙은 작은 금액: 500원', () => {
    expect(extractAmount('사탕 500원')?.amount).toBe(500)
  })
  it('단위 없는 맨숫자 1000 이상만: 5500', () => {
    expect(extractAmount('커피 5500')?.amount).toBe(5_500)
    expect(extractAmount('커피 2잔')).toBeNull()
  })
  it('순한글 금액도 읽는다: 만이천원', () => {
    expect(extractAmount('택시 만이천원')?.amount).toBe(12_000)
  })
  it('숫자 여러 개면 금액 쪽 채택: 2명이서 3만원', () => {
    expect(extractAmount('2명이서 3만원')?.amount).toBe(30_000)
  })
})

describe('parseConfessionText — 카테고리 매칭', () => {
  it('카테고리명 직접 포함', () => {
    const r = parseConfessionText('배달 2만3천원', cats)
    expect(r.entries[0]).toMatchObject({ category: '배달', kind: 'variable', amount: 23_000 })
  })
  it('내장 별칭: 점심→식비, 커피→카페, 택시→자동차', () => {
    const r = parseConfessionText('점심 9천원, 커피 5,500원, 택시 12,000원', cats)
    expect(r.entries.map((e) => e.category)).toEqual(['식비', '카페', '자동차'])
    expect(r.entries.map((e) => e.amount)).toEqual([9_000, 5_500, 12_000])
  })
  it('학습 별칭이 내장보다 우선', () => {
    const r = parseConfessionText('커피 5000원', cats, { 커피: '식비' })
    expect(r.entries[0].category).toBe('식비')
  })
  it('매칭 실패 → 기타 + matched:false + 원문 note', () => {
    const r = parseConfessionText('뽑기 3천원', cats)
    expect(r.entries[0]).toMatchObject({ category: '기타', matched: false, note: '뽑기' })
  })
  it('금액 없는 조각은 skipped로', () => {
    const r = parseConfessionText('오늘 너무 힘들었다, 커피 5천원', cats)
    expect(r.skipped).toEqual(['오늘 너무 힘들었다'])
    expect(r.entries).toHaveLength(1)
  })
  it('줄바꿈·그리고 구분자', () => {
    const r = parseConfessionText('마트 3만원\n영화 15000원 그리고 주유 5만원', cats)
    expect(r.entries.map((e) => e.category)).toEqual(['식비', '문화생활', '자동차'])
  })
  // 음성인식은 쉼표를 넣어주지 않는다 — 실제 사용 중 발견된 케이스
  it('쉼표 없이 말한 두 건을 각각 인식한다', () => {
    const r = parseConfessionText('점심 9000원 커피 5500원', cats)
    expect(r.entries).toHaveLength(2)
    expect(r.entries.map((e) => e.category)).toEqual(['식비', '카페'])
    expect(r.entries.map((e) => e.amount)).toEqual([9000, 5500])
    expect(r.entries.map((e) => e.note)).toEqual(['점심', '커피'])
  })

  it('쉼표 없이 말한 세 건도 각각 인식한다', () => {
    const r = parseConfessionText('점심 9천원 택시 12000원 넷플릭스 17000원', cats)
    expect(r.entries.map((e) => e.category)).toEqual(['식비', '자동차', '구독'])
    expect(r.entries.map((e) => e.amount)).toEqual([9000, 12000, 17000])
  })

  it('조사가 붙어도 이름을 뽑아낸다', () => {
    const r = parseConfessionText('점심에 9000원 커피는 5500원', cats)
    expect(r.entries.map((e) => e.category)).toEqual(['식비', '카페'])
  })

  it('어순이 뒤집혀도(금액 먼저) 이름을 찾는다', () => {
    const r = parseConfessionText('9000원 점심', cats)
    expect(r.entries[0]).toMatchObject({ category: '식비', amount: 9000 })
  })

  it('한 건은 그대로 한 건 (다건 분리가 오작동하지 않음)', () => {
    const r = parseConfessionText('택시 12,000원', cats)
    expect(r.entries).toHaveLength(1)
    expect(r.entries[0]).toMatchObject({ category: '자동차', amount: 12000 })
  })

  it("'3만 5천원' 같은 복합 표기는 한 건으로 본다", () => {
    const r = parseConfessionText('회식 3만 5천원', cats)
    expect(r.entries).toHaveLength(1)
    expect(r.entries[0].amount).toBe(35000)
  })

  it('고정지출 별칭: 넷플릭스→구독', () => {
    const r = parseConfessionText('넷플릭스 17,000원', cats)
    expect(r.entries[0]).toMatchObject({ category: '구독', kind: 'fixed' })
  })
  it("'기타'를 지운 가구에선 폴백이 실재하는 첫 카테고리", () => {
    const custom = { ...cats, variable: ['배달', '카페'] } // 기타 없음
    const r = parseConfessionText('택시 3천원', custom)
    expect(r.entries[0]).toMatchObject({ category: '배달', matched: false })
  })
})

describe('한글 숫자 금액', () => {
  // 제보 재현: "마트 오만 5000원"을 적었는데 5,000원만 잡혔다
  it('한글과 숫자가 섞여도 합쳐서 읽는다: 오만 5000원 = 55,000', () => {
    expect(extractAmount('마트 오만 5000원')?.amount).toBe(55_000)
    expect(extractAmount('마트 오만 5000원')?.rest).toBe('마트')
  })

  it('순한글 수사를 읽는다', () => {
    expect(extractAmount('마트 오만원')?.amount).toBe(50_000)
    expect(extractAmount('커피 구천원')?.amount).toBe(9_000)
    expect(extractAmount('장보기 삼만오천원')?.amount).toBe(35_000)
    expect(extractAmount('월세 십만원')?.amount).toBe(100_000)
    expect(extractAmount('선물 이십만원')?.amount).toBe(200_000)
  })

  it('숫자와 한글 단위를 섞어 써도 된다', () => {
    expect(extractAmount('택시 3만 2천원')?.amount).toBe(32_000)
    expect(extractAmount('밥 1만2천')?.amount).toBe(12_000)
    expect(extractAmount('회식 5만 5000원')?.amount).toBe(55_000)
  })

  // 여기가 진짜 어려운 부분 — 수사가 든 평범한 말을 금액으로 읽으면 안 된다
  it('수사가 들어간 낱말은 금액이 아니다', () => {
    expect(extractAmount('천천히 걸었어요')).toBeNull()
    expect(extractAmount('친구 만나서 놀았어요')).toBeNull()
    expect(extractAmount('이만큼 아꼈어요')).toBeNull()
    expect(extractAmount('고기만두 사먹음')).toBeNull()
  })

  it('낱말 사이에 있어도 진짜 금액은 찾아낸다', () => {
    expect(extractAmount('친구 만나서 밥 2만원')?.amount).toBe(20_000)
    expect(extractAmount('고기만두 3000원')?.amount).toBe(3_000)
  })

  it('한글 금액 두 건도 각각 나눈다', () => {
    const r = parseConfessionText('점심 만원 커피 오천원', cats)
    expect(r.entries.map((e) => e.amount)).toEqual([10_000, 5_000])
    expect(r.entries.map((e) => e.category)).toEqual(['식비', '카페'])
  })
})
