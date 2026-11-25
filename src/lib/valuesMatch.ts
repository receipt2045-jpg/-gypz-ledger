/**
 * 가치관 체크리스트 궁합 점수 — 1~5점(1 매우 아니다 … 5 매우 그렇다).
 * 한 줄 점수 = 1 − |아내 − 남편| ÷ 4 (같으면 1, 정반대 1↔5 면 0). 궁합 % = 둘 다 답한 줄의 평균.
 * 한 칸 차이(4와 5 등)는 '비슷'으로 센다. 정답이 있는 게 아니라 낮은 점수도 '이야기할 거리'로 말한다.
 */
export const SCALE = ['', '매우 아니다', '아니다', '보통', '그렇다', '매우 그렇다'] as const

export interface GroupMatch {
  title: string
  emoji: string
  /** 비슷한 줄 수(차이 0~1) */
  same: number
  both: number
  /** 0~1 평균 점수 */
  score: number
}
export interface ValuesMatch {
  percent: number
  both: number
  same: number
  diff: number
  label: string
  line: string
  groups: GroupMatch[]
  best: GroupMatch | null
  worst: GroupMatch | null
}

export function matchLabel(percent: number): { label: string; line: string } {
  if (percent >= 90) return { label: '찰떡 부부', line: '돈 이야기, 눈빛만 봐도 통해요' }
  if (percent >= 75) return { label: '잘 맞는 부부', line: '큰 방향은 같아요. 다른 몇 개만 맞춰 보세요' }
  if (percent >= 60) return { label: '맞춰 가는 부부', line: '다른 게 꽤 있어요. 하나씩 이야기하면 돼요' }
  return { label: '이야기가 필요한 부부', line: '생각이 많이 달라요. 지금 알아서 다행이에요' }
}

export const gap = (a: number, b: number) => Math.abs(a - b)

export function computeMatch(
  groups: { title: string; emoji: string; items: string[] }[],
  wife: number[],
  husband: number[],
): ValuesMatch {
  let i = 0
  let sum = 0
  const gs: GroupMatch[] = groups.map((g) => {
    let same = 0,
      both = 0,
      s = 0
    for (let k = 0; k < g.items.length; k++, i++) {
      if (wife[i] && husband[i]) {
        both++
        const d = gap(wife[i], husband[i])
        s += 1 - d / 4
        if (d <= 1) same++
      }
    }
    sum += s
    return { title: g.title, emoji: g.emoji, same, both, score: both ? s / both : 0 }
  })
  const both = gs.reduce((t, g) => t + g.both, 0)
  const same = gs.reduce((t, g) => t + g.same, 0)
  const percent = both ? Math.round((sum / both) * 100) : 0
  const rated = gs.filter((g) => g.both > 0)
  const best = rated.length ? rated.reduce((a, b) => (b.score > a.score ? b : a)) : null
  const worst = rated.length ? rated.reduce((a, b) => (b.score < a.score ? b : a)) : null
  return { percent, both, same, diff: both - same, ...matchLabel(percent), groups: gs, best, worst }
}
