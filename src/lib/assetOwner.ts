import type { AssetItem, Profile } from '../types'

/**
 * 자산 주인은 이름 글자로 저장된다 (공동·부부 이름·자녀 이름).
 * 그래서 설정에서 이름을 바꾸면 예전 이름으로 저장된 통장이 아무 데도 안 보였다 —
 * 합계(2억)는 나오는데 자산 등록에선 '0개' (2026-10-07 제보).
 * 이 파일이 그 짝을 맞춘다: 이름 바꿀 때 같이 바꾸기, 이미 엇갈린 것 고치기, 그래도 모르면 '공동'으로 보이기.
 */

const DEFAULT_NAMES: [string, string] = ['남편', '아내']

export function knownOwners(profile: Profile): string[] {
  return ['공동', profile.member1Name, profile.member2Name, ...(profile.childNames ?? [])]
}

/** 지금 이름 목록에 없는 주인 — 예전 이름으로 남은 통장 */
export function isOrphanOwner(owner: string | undefined, profile: Profile): boolean {
  return !!owner && !knownOwners(profile).includes(owner)
}

/** 화면에 보일 주인 — 모르는 이름은 '공동'으로 (두 사람 모두에게 보이고 고칠 수 있게) */
export function displayOwner(owner: string | undefined, profile: Profile): string {
  return !owner || isOrphanOwner(owner, profile) ? '공동' : owner
}

/** 이름이 from → to로 바뀌었을 때. 바뀐 게 없으면 null */
export function renameOwner(items: AssetItem[], from: string, to: string): AssetItem[] | null {
  if (!from || !to || from === to || to === '공동') return null
  let changed = false
  const next = items.map((it) => {
    if (it.owner !== from) return it
    changed = true
    return { ...it, owner: to }
  })
  return changed ? next : null
}

/**
 * 이미 엇갈린 것 고치기 — 기본 이름('남편'·'아내')으로 넣은 뒤 이름을 바꾼 집.
 * '남편'은 구성원 1, '아내'는 구성원 2로. 그 밖의 모르는 이름은 건드리지 않는다(화면에선 공동).
 */
export function repairOwners(items: AssetItem[], profile: Profile): AssetItem[] | null {
  const names = [profile.member1Name, profile.member2Name]
  let changed = false
  const next = items.map((it) => {
    if (!isOrphanOwner(it.owner, profile)) return it
    const i = DEFAULT_NAMES.indexOf(it.owner!)
    if (i < 0) return it
    changed = true
    return { ...it, owner: names[i] }
  })
  return changed ? next : null
}
