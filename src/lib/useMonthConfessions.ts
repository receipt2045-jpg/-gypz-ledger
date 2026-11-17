import { useEffect } from 'react'
import { useLedgerStore } from './store'

/**
 * 그 달 소비 기록이 앱에 다 있게 한다 (2026-11-17 의견: "이전에 입력해둔 소비기록이 사라져요").
 * 앱을 열 때는 최근 62일만 읽는다. 그보다 앞선 달을 가계부·정산에서 열면 그 달 1일까지 더 읽어 온다.
 * 정산 합계(confessSums)도 같은 기록으로 계산되니, 오래된 달을 정산할 때 빠지는 돈이 없어진다.
 */
export function useMonthConfessions(ym: string) {
  const load = useLedgerStore((s) => s.loadOlderConfessions)
  useEffect(() => {
    void load(new Date(`${ym}-01T00:00:00`))
  }, [ym, load])
}
