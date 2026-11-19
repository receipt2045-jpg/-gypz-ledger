import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLedgerStore } from './store'
import { localSide, remoteSide, sampleSide, type NewSideIncome, type SideApi } from './sideDb'
import { displayYm, resolveLedger, resolveSnapshot } from './carryover'
import {
  applyToAssets,
  applyToLedger,
  type SideAllocation,
  type SideIncome,
  type SideSettlement,
} from './sideIncome'

/**
 * 부수입 데이터 — 로그인했으면 서버, 둘러보기면 예시(메모리).
 * 고칠 때마다 다시 불러온다 — 부부 둘이 같이 쓰는 화면이라 배우자가 적은 것도 같이 보이게.
 */
export function useSideIncome() {
  const householdId = useLedgerStore((s) => s.householdId)
  const memberNo = useLedgerStore((s) => s.memberNo) ?? 1
  const api: SideApi = useMemo(
    () => (householdId ? remoteSide(householdId) : localSide(sampleSide())),
    [householdId],
  )
  const [entries, setEntries] = useState<SideIncome[]>([])
  const [settles, setSettles] = useState<SideSettlement[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const reload = useCallback(async () => {
    try {
      const d = await api.load()
      setEntries(d.entries)
      setSettles(d.settles)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [api])

  useEffect(() => {
    void reload()
  }, [reload])

  const add = async (n: NewSideIncome) => {
    await api.add(n)
    await reload()
  }
  const update = async (id: string, patch: Partial<NewSideIncome>) => {
    await api.update(id, patch)
    await reload()
  }
  const remove = async (id: string) => {
    await api.remove(id)
    await reload()
  }

  /**
   * 부수입 마감 — 보낸 곳에 실제로 반영한다.
   * 자산 통장: 자산 탭이 보여 주는 달의 그 통장 금액에 더한다.
   * 살림에 보태기: 그 달 가계부 '부수입' 실제 금액에 남편·아내 몫으로 더한다.
   */
  const settle = async (ym: string, allocations: SideAllocation[]) => {
    await api.settle(ym, allocations)
    applyEffects(ym, allocations, 1)
    await reload()
  }

  /** 마감 풀기 — 더했던 만큼 다시 뺀다 */
  const unsettle = async (ym: string) => {
    const s = settles.find((x) => x.ym === ym)
    await api.unsettle(ym)
    if (s) applyEffects(ym, s.allocations, -1)
    await reload()
  }

  return {
    entries,
    settles,
    status,
    reload,
    add,
    update,
    remove,
    settle,
    unsettle,
    me: memberNo,
    sample: !householdId,
  }
}

function applyEffects(ym: string, allocations: SideAllocation[], sign: 1 | -1) {
  const st = useLedgerStore.getState()
  if (allocations.some((a) => a.to === 'asset' && a.amount > 0)) {
    const snapYm = displayYm(st.snapshots)
    const base = resolveSnapshot(st.snapshots, snapYm)
    st.saveSnapshot({ ...base, ym: snapYm, items: applyToAssets(base.items, allocations, sign) })
  }
  if (allocations.some((a) => a.to === 'living' && a.amount > 0)) {
    const base = resolveLedger(st.ledgers, ym)
    st.saveLedger(applyToLedger(base, allocations, sign))
  }
}
