import { DEFAULT_INPUT, MONTHS_MAX, type LeaveInput } from './parentalLeave'

/**
 * 육아휴직 계산기 공유 — 링크에 우리집 숫자를 실어 보낸다.
 *
 * 받은 사람(남편·아내)이 열면 같은 결과가 바로 보인다.
 * 숫자는 주소의 # 뒤에 들어가서 서버로는 가지 않는다(해시는 브라우저 밖으로 안 나간다).
 */

const KEYS: (keyof LeaveInput)[] = [
  'payWife',
  'payHusband',
  'fixed',
  'variable',
  'who',
  'monthsWife',
  'monthsHusband',
  'order',
  'childCost',
  'daycareFrom',
  'insuredWife',
  'insuredHusband',
  'sideWife',
  'sideHusband',
]

function toBase64Url(s: string): string {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const b = s.replace(/-/g, '+').replace(/_/g, '/')
  return atob(b + '='.repeat((4 - (b.length % 4)) % 4))
}

export function encodeLeave(v: LeaveInput): string {
  return toBase64Url(JSON.stringify(KEYS.map((k) => v[k])))
}

const money = (x: unknown) =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.round(x) : null
const months = (x: unknown) =>
  typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= MONTHS_MAX ? x : null

/** 링크에서 숫자를 꺼낸다. 이상한 값은 버리고 기본값으로 채운다. 못 읽으면 null */
export function decodeLeave(s: string): LeaveInput | null {
  let arr: unknown
  try {
    arr = JSON.parse(fromBase64Url(s))
  } catch {
    return null
  }
  if (!Array.isArray(arr)) return null
  const raw = Object.fromEntries(KEYS.map((k, i) => [k, arr[i]])) as Record<
    keyof LeaveInput,
    unknown
  >
  const d = DEFAULT_INPUT
  return {
    payWife: money(raw.payWife) ?? d.payWife,
    payHusband: money(raw.payHusband) ?? d.payHusband,
    fixed: money(raw.fixed) ?? d.fixed,
    variable: money(raw.variable) ?? d.variable,
    who: raw.who === 'wife' || raw.who === 'husband' || raw.who === 'both' ? raw.who : d.who,
    monthsWife: months(raw.monthsWife) ?? d.monthsWife,
    monthsHusband: months(raw.monthsHusband) ?? d.monthsHusband,
    order: raw.order === 'seq' || raw.order === 'sim' ? raw.order : d.order,
    childCost: money(raw.childCost) ?? d.childCost,
    daycareFrom:
      raw.daycareFrom === 0 || raw.daycareFrom === 7 || raw.daycareFrom === 13
        ? raw.daycareFrom
        : d.daycareFrom,
    insuredWife: typeof raw.insuredWife === 'boolean' ? raw.insuredWife : d.insuredWife,
    insuredHusband: typeof raw.insuredHusband === 'boolean' ? raw.insuredHusband : d.insuredHusband,
    sideWife: money(raw.sideWife) ?? d.sideWife,
    sideHusband: money(raw.sideHusband) ?? d.sideHusband,
  }
}

/** 지금 주소(#/leave?s=...)에서 공유받은 숫자를 꺼낸다 */
export function sharedFromHash(hash: string): LeaveInput | null {
  const q = hash.split('?')[1]
  if (!q) return null
  const s = new URLSearchParams(q).get('s')
  return s ? decodeLeave(s) : null
}

export function leaveShareUrl(v: LeaveInput, origin: string): string {
  return `${origin}/#/leave?s=${encodeLeave(v)}`
}

export const SHARE_TEXT =
  '육아휴직하면 우리집은 한 달에 얼마 모일까? 우리 숫자로 계산해봤어. 같이 보자!'

/** 공유 시트 → 안 되면 링크 복사 */
export async function shareLeaveLink(v: LeaveInput): Promise<'shared' | 'copied' | 'failed'> {
  const url = leaveShareUrl(v, window.location.origin)
  if (navigator.share) {
    try {
      await navigator.share({ title: '모아불리 육아휴직 계산기', text: SHARE_TEXT, url })
      return 'shared'
    } catch (err) {
      // 공유 시트를 닫은 것 — 복사로 내려가지 않고 조용히 끝낸다
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared'
    }
  }
  try {
    await navigator.clipboard.writeText(`${SHARE_TEXT}\n${url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}
