/**
 * 가치관 체크리스트 궁합 점수 — 둘 다 답한 줄 중 같은 답 비율.
 * 정답이 있는 게 아니라서 낮은 점수도 '나쁘다'가 아니라 '이야기할 거리'로 말한다.
 */
export interface GroupMatch {
  title: string
  emoji: string
  same: number
  both: number
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

export function computeMatch(
  groups: { title: string; emoji: string; items: string[] }[],
  wife: number[],
  husband: number[],
): ValuesMatch {
  let i = 0
  const gs: GroupMatch[] = groups.map((g) => {
    let same = 0,
      both = 0
    for (let k = 0; k < g.items.length; k++, i++) {
      if (wife[i] && husband[i]) {
        both++
        if (wife[i] === husband[i]) same++
      }
    }
    return { title: g.title, emoji: g.emoji, same, both }
  })
  const both = gs.reduce((s, g) => s + g.both, 0)
  const same = gs.reduce((s, g) => s + g.same, 0)
  const percent = both ? Math.round((same / both) * 100) : 0
  const rated = gs.filter((g) => g.both > 0)
  const rate = (g: GroupMatch) => g.same / g.both
  const best = rated.length ? rated.reduce((a, b) => (rate(b) > rate(a) ? b : a)) : null
  const worst = rated.length ? rated.reduce((a, b) => (rate(b) < rate(a) ? b : a)) : null
  return { percent, both, same, diff: both - same, ...matchLabel(percent), groups: gs, best, worst }
}
