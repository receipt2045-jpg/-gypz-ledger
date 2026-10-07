import { beforeEach, describe, expect, it } from 'vitest'
import { displayOwner, renameOwner, repairOwners } from './assetOwner'
import { useLedgerStore } from './store'
import { seedStore } from '../test/renderScreen'
import type { AssetItem, Profile } from '../types'

const profile: Profile = {
  member1Name: '현수',
  member2Name: '시내',
  childNames: [],
  targetNetWorth: 0,
  startYear: 2026,
}

const asset = (id: string, owner?: string): AssetItem => ({
  id,
  kind: 'asset',
  group: 'pension',
  name: '연금 ' + id,
  amount: 1_000_000,
  ...(owner ? { owner } : {}),
})

// 제보 재현: 처음에 기본 이름(남편·아내)으로 자산을 넣고 이름을 바꿨더니,
// 자산 탭 합계는 2억인데 자산 등록에선 '아직 등록한 계좌가 없어요'
describe('자산 주인 — 이름을 바꾼 집', () => {
  it('예전 기본 이름은 지금 이름으로 고친다 (남편 → 구성원 1, 아내 → 구성원 2)', () => {
    const out = repairOwners([asset('a', '남편'), asset('b', '아내'), asset('c', '공동')], profile)
    expect(out!.map((it) => it.owner)).toEqual(['현수', '시내', '공동'])
  })

  it('고칠 게 없으면 null', () => {
    expect(repairOwners([asset('a', '현수'), asset('b')], profile)).toBeNull()
  })

  it('그래도 모르는 이름은 화면에서 공동으로 — 두 사람 모두 보고 고칠 수 있게', () => {
    expect(displayOwner('예전이름', profile)).toBe('공동')
    expect(displayOwner(undefined, profile)).toBe('공동')
    expect(displayOwner('시내', profile)).toBe('시내')
  })

  it('이름을 바꾸면 그 이름의 자산 주인도 같이 바뀐다', () => {
    const out = renameOwner([asset('a', '현수'), asset('b', '시내')], '현수', '현수씨')
    expect(out!.map((it) => it.owner)).toEqual(['현수씨', '시내'])
    expect(renameOwner([asset('a', '현수')], '현수', '공동')).toBeNull()
  })
})

describe('스토어 — 설정에서 이름 바꾸기', () => {
  beforeEach(() =>
    seedStore({
      snapshots: [
        { ym: '2026-09', items: [asset('a', '남편'), asset('b', '아내')] },
        { ym: '2026-10', items: [asset('a', '남편'), asset('c', '공동')] },
      ],
    }),
  )

  it('이름을 바꾸면 모든 달의 자산 주인이 따라간다', () => {
    useLedgerStore.getState().updateProfile({ member1Name: '현수' })
    const owners = useLedgerStore
      .getState()
      .snapshots.map((sn) => sn.items.map((it) => it.owner).join(','))
    expect(owners).toEqual(['현수,아내', '현수,공동'])
  })

  it('이름표 서로 바꾸기(1↔2)는 사람이 그대로라 주인을 건드리지 않는다', () => {
    useLedgerStore.getState().updateProfile({ member1Name: '아내', member2Name: '남편' })
    expect(useLedgerStore.getState().snapshots[0].items.map((it) => it.owner)).toEqual([
      '남편',
      '아내',
    ])
  })

  it('이미 어긋난 집은 불러올 때 고친다', () => {
    useLedgerStore.setState({ profile: { ...useLedgerStore.getState().profile, ...profile } })
    useLedgerStore.getState().repairAssetOwners()
    expect(useLedgerStore.getState().snapshots[0].items.map((it) => it.owner)).toEqual([
      '현수',
      '시내',
    ])
  })
})
