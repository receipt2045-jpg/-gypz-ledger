import { findCategoryGroup } from './constants'
import type { Categories, CategoryGroup } from '../types'

/**
 * 카테고리 추가·삭제를 '바뀐 것'만 서버 최신 목록에 얹는다 (2026-10-07).
 *
 * 제보: "카테고리를 여러 개 추가했는데 고를 때 다 안 나와요".
 * 예전엔 추가·삭제할 때마다 내 화면의 목록 전체를 서버에 덮어썼다. 배우자나 다른 기기에서
 * 그 사이 추가한 카테고리는 오래된 목록에 없으니 지워졌다(재시도 큐가 옛 목록을 다시 보낼 때도).
 * 이제는 서버 최신 목록을 읽어 이 변경만 적용한 뒤 저장한다.
 */
export type CategoryChange =
  | { action: 'add' | 'remove'; group: CategoryGroup; name: string }
  /** 예산·정산에서 바꾼 순서 — 적힌 이름을 이 순서로 앞에, 나머지는 원래 순서대로 뒤에 (2026-10-07) */
  | { action: 'order'; group: CategoryGroup; names: string[] }

export function applyCategoryChanges(cats: Categories, changes: CategoryChange[]): Categories {
  let next = cats
  for (const ch of changes) {
    if (ch.action === 'order') {
      const list = next[ch.group] ?? []
      const front = ch.names.filter((n, i) => list.includes(n) && ch.names.indexOf(n) === i)
      const ordered = [...front, ...list.filter((n) => !front.includes(n))]
      if (ordered.some((n, i) => n !== list[i])) next = { ...next, [ch.group]: ordered }
      continue
    }
    const name = ch.name.trim()
    if (!name) continue
    const list = next[ch.group] ?? []
    if (ch.action === 'add') {
      // 이미 있거나, 다른 그룹에 같은 이름이 있으면 넣지 않는다 (스텝마다 갈라지는 문제)
      if (list.includes(name) || findCategoryGroup(next, name, ch.group)) continue
      next = { ...next, [ch.group]: [...list, name] }
    } else {
      if (!list.includes(name)) continue
      next = { ...next, [ch.group]: list.filter((c) => c !== name) }
    }
  }
  return next
}

/** 예전 재시도 큐의 '목록 통째' 저장을 변경 목록으로 — 빠진 것만 더한다(지우지는 않는다) */
export function changesFromSnapshot(snapshot: Categories): CategoryChange[] {
  return (Object.keys(snapshot) as CategoryGroup[]).flatMap((group) =>
    (snapshot[group] ?? []).map((name) => ({ action: 'add' as const, group, name })),
  )
}
