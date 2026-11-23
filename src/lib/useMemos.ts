import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLedgerStore } from './store'
import { localMemo, remoteMemo, sampleMemos, sortMemos, type Memo, type MemoApi } from './memoDb'

// 둘러보기 예시는 화면을 옮겨도 적은 게 남게 한 번만 만든다
let sampleApi: MemoApi | null = null

/** 우리집 메모 — 로그인했으면 서버, 둘러보기면 예시. 고칠 때마다 다시 불러와 배우자가 쓴 것도 보인다 */
export function useMemos() {
  const householdId = useLedgerStore((s) => s.householdId)
  const me = useLedgerStore((s) => s.memberNo) ?? 1
  const api = useMemo(
    () => (householdId ? remoteMemo(householdId) : (sampleApi ??= localMemo(sampleMemos()))),
    [householdId],
  )
  const [memos, setMemos] = useState<Memo[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const reload = useCallback(async () => {
    try {
      setMemos(sortMemos(await api.load()))
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [api])

  useEffect(() => {
    void reload()
  }, [reload])

  const run = (fn: () => Promise<void>) => async () => {
    await fn()
    await reload()
  }

  return {
    memos,
    status,
    me,
    reload,
    add: (body: string) => run(() => api.add(body, me))(),
    update: (id: string, patch: Partial<Pick<Memo, 'body' | 'pinned'>>) =>
      run(() => api.update(id, patch))(),
    remove: (id: string) => run(() => api.remove(id))(),
  }
}
