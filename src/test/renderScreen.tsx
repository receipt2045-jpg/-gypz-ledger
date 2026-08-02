import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { useLedgerStore } from '../lib/store'
import { DEFAULT_CATEGORIES } from '../lib/constants'
import type { AppData, AssetSnapshot, Confession, MonthlyLedger } from '../types'

export const TEST_YM = '2026-08'

const BASE_PROFILE: AppData['profile'] = {
  member1Name: '남편',
  member2Name: '아내',
  childNames: [],
  targetNetWorth: 1_000_000_000,
  startYear: 2026,
}

interface Seed {
  ledgers?: MonthlyLedger[]
  snapshots?: AssetSnapshot[]
  confessions?: Confession[]
  memberNo?: 1 | 2
}

/**
 * 스토어를 정해진 상태로 채운다.
 *
 * householdId는 일부러 null로 둔다 — 스토어 액션들이 그때만 Supabase 호출을
 * 건너뛰기 때문에, 테스트가 네트워크를 타지 않고 저장 결과를 로컬에서 볼 수 있다.
 */
export function seedStore({ ledgers = [], snapshots = [], confessions = [], memberNo = 2 }: Seed) {
  useLedgerStore.setState({
    status: 'ready',
    householdId: null,
    memberNo,
    inviteCode: null,
    sample: false,
    profile: BASE_PROFILE,
    categories: {
      income: [...DEFAULT_CATEGORIES.income],
      saving: [...DEFAULT_CATEGORIES.saving],
      investment: [...DEFAULT_CATEGORIES.investment],
      fixed: [...DEFAULT_CATEGORIES.fixed],
      variable: [...DEFAULT_CATEGORIES.variable],
    },
    ledgers,
    snapshots,
    occasions: [],
    confessions,
    aliases: {},
    pendingSync: 0,
    syncFailed: false,
  })
}

/** 화면 하나를 라우터에 얹어 띄우고, 클릭·입력을 흉내낼 도구를 준다 */
export function renderScreen(ui: ReactElement) {
  const user = userEvent.setup()
  const result = render(<MemoryRouter>{ui}</MemoryRouter>)
  return { ...result, user }
}

/** 저장된 결과 확인용 — 지금 스토어에 들어있는 그 달 항목들 */
export function savedItems(ym = TEST_YM) {
  return useLedgerStore.getState().ledgers.find((l) => l.ym === ym)?.items ?? []
}

/** 저장된 결과 확인용 — 지금 스토어에 들어있는 그 달 자산들 */
export function savedAssets(ym = TEST_YM) {
  return useLedgerStore.getState().snapshots.find((s) => s.ym === ym)?.items ?? []
}
