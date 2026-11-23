import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLedgerStore } from './store'
import { localSide, remoteSide, sampleSide, type NewSideIncome, type SideApi } from './sideDb'
import { displayYm, resolveLedger, resolveSnapshot } from './carryover'
import {
  applyToAssets,
  applyToLedger,
  dueRepeats,
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
      let d = await api.load()
      // 매달로 표시한 것 중 아직 안 적힌 달을 채운다 (2026-11-23)
      const due = dueRepeats(d.entries, new Date().toLocaleDateString('sv-SE'))
      if (due.length) {
        try {
          await api.addMany(due)
          d = await api.load()
        } catch {
          /* 못 채워도 화면은 그대로 — 다음에 열 때 다시 */
        }
      }
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
  /** 여러 줄 한꺼번에 (붙여넣기·엑셀 올리기) — 한 번만 다시 불러온다 */
  const addBulk = async (list: NewSideIncome[]) => {
    const now = new Date().toISOString()
    await api.addMany(list.map((n) => ({ ...n, id: crypto.randomUUID(), createdAt: now })))
    await reload()
  }
  const update = async (id: string, patch: Partial<NewSideIncome>) => {
    await api.update(id, patch)
    await reload()
  }
  /**
   * 종류 이름 바꾸기 — 그 구분·종류로 적힌 기록을 모든 달에서 한꺼번에 (2026-11-24 결영 요청).
   * 이미 있는 종류 이름으로 바꾸면 그 종류로 합쳐진다.
   */
  const renameCategory = async (kind: SideIncome['kind'], from: string, to: string) => {
    const list = entries.filter((e) => e.kind === kind && e.category === from)
    for (const e of list) await api.update(e.id, { category: to })
    await reload()
    return list.length
  }
  /**
   * 지우기 — 매달 기록을 지우면 다음에 열 때 같은 달이 또 생긴다.
   * 그래서 묶음의 가장 최근 기록이면 남은 것 중 가장 최근 기록의 '매달'을 끈다(멈춤).
   */
  const remove = async (id: string) => {
    const target = entries.find((e) => e.id === id)
    await api.remove(id)
    if (target?.repeat) {
      const series = target.series ?? target.id
      const rest = entries
        .filter((e) => e.id !== id && (e.series ?? e.id) === series)
        .sort((a, b) => (a.earnedOn < b.earnedOn ? 1 : -1))
      if (rest[0]?.repeat && rest[0].earnedOn <= target.earnedOn)
        await api.update(rest[0].id, { repeat: false })
    }
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
    addBulk,
    update,
    renameCategory,
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
