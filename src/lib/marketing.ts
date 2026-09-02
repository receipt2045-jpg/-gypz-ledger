import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

/**
 * 마케팅 정보 수신 동의 (선택).
 *
 * 정보통신망법상 광고성 정보를 보내려면 미리 동의를 받아야 하고, 그 동의는
 * - 가입에 필수인 동의와 '따로' 구분돼야 하며
 * - 기본값이 체크돼 있으면 안 되고
 * - 언제든 철회할 수 있어야 하고
 * - 나중에 "동의받았다"를 대려면 받은 시각이 남아 있어야 한다.
 *
 * 그래서 계정(user_metadata)에 값과 시각을 함께 남긴다.
 */

const KEY = 'moabuli_marketing'

export interface MarketingConsent {
  on: boolean
  at?: string // 동의한 시각
  offAt?: string // 철회한 시각
}

/** 계정에 남아 있는 동의 상태 (모르면 false). */
export function marketingConsentOf(user: User | null): boolean {
  return user?.user_metadata?.marketingOptIn === true
}

/**
 * 구글 로그인은 다른 페이지를 거쳐 돌아온다 — 그 사이 화면 상태가 사라지므로
 * 누르고 간 선택을 localStorage에 맡겨 둔다. (초대 코드와 같은 이유)
 */
export function stashMarketingChoice(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    // 시크릿 모드 등 — 설정 화면에서 다시 켤 수 있다
  }
}

function takeMarketingChoice(): boolean | null {
  try {
    const v = localStorage.getItem(KEY)
    if (v !== '0' && v !== '1') return null
    localStorage.removeItem(KEY)
    return v === '1'
  } catch {
    return null
  }
}

/**
 * 로그인 직후 1회. 가입 화면에서 고른 값을 계정에 옮긴다.
 *
 * 이미 계정에 값이 있으면 건드리지 않는다 — 설정에서 끈 사람이
 * 다시 로그인했다고 몰래 켜지면 안 된다.
 */
export async function applyMarketingChoice(user: User): Promise<void> {
  const choice = takeMarketingChoice()
  if (choice === null) return
  if (typeof user.user_metadata?.marketingOptIn === 'boolean') return
  try {
    await setMarketingConsent(choice)
  } catch {
    // 다음에 설정 화면에서 켤 수 있다 — 가입 자체를 막지는 않는다
  }
}

/** 동의/철회를 계정에 기록한다. 시각도 함께 남긴다(증빙). */
export async function setMarketingConsent(on: boolean): Promise<void> {
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { marketingOptIn: on }
  if (on) patch.marketingOptInAt = now
  else patch.marketingOptOutAt = now
  const { error } = await supabase.auth.updateUser({ data: patch })
  if (error) throw error
}
