/**
 * 폰 푸시 알림 (2026-11-04, 푸시 2단계). 웹에서는 아무것도 하지 않는다.
 * - 앱 시작 시 installPush(): 알림 채널, 토큰 받기·알림 누르기 리스너
 * - 로그인 후 syncPushToken(): 권한이 있고 알림 설정을 만든 사람만 토큰을 다시 등록
 * 플러그인이 없는 1.1.0 앱이 새 웹을 불러와도 죽지 않게 pushSupported()로 먼저 확인한다.
 */
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { isNative } from './native'
import { fetchPrefs, forgetToken, registerToken } from './pushPrefs'

/** supabase/functions/_shared/fcm.ts, AndroidManifest 기본 채널과 같아야 한다 */
export const CHANNEL_ID = 'moabuli'
const TOKEN_KEY = 'pushToken'

export type PushPermission = 'granted' | 'denied' | 'prompt'

export function pushSupported(): boolean {
  return isNative() && Capacitor.isPluginAvailable('PushNotifications')
}

/** 우리 앱 안 경로만 ('/'로 시작, 바깥 주소 아님) */
export function safePath(p: unknown): string | null {
  if (typeof p !== 'string' || !p.startsWith('/') || p.startsWith('//') || p.includes('://')) return null
  return p
}

export function openFromNotification(data: unknown): void {
  const path = safePath((data as { path?: unknown } | null)?.path)
  if (path) window.location.hash = `#${path}`
}

const warn = (what: string) => (err: unknown) => console.warn(`[push] ${what}`, err)

function keepToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // 없어도 된다 — 로그아웃 때 못 지울 뿐, 앱을 지우면 서버가 무효 토큰으로 지운다
  }
}

function storedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

let installed = false

export function installPush(): void {
  if (!pushSupported() || installed) return
  installed = true
  PushNotifications.createChannel({ id: CHANNEL_ID, name: '모아불리 알림', importance: 4 }).catch(warn('채널'))
  PushNotifications.addListener('registration', ({ value }) => {
    keepToken(value)
    registerToken(value).catch(warn('토큰 등록'))
  }).catch(warn('registration'))
  PushNotifications.addListener('registrationError', warn('토큰 발급')).catch(warn('registrationError'))
  PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) =>
    openFromNotification(notification.data),
  ).catch(warn('알림 누르기'))
}

export async function pushPermission(): Promise<PushPermission> {
  if (!pushSupported()) return 'denied'
  try {
    const { receive } = await PushNotifications.checkPermissions()
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt'
  } catch {
    return 'denied'
  }
}

/** OS 권한 창. 거부·실패는 조용히 false */
export async function askPushPermission(): Promise<boolean> {
  if (!pushSupported()) return false
  try {
    return (await PushNotifications.requestPermissions()).receive === 'granted'
  } catch {
    return false
  }
}

/** 토큰 발급 → 'registration' 리스너가 등록한다 */
export async function startPush(): Promise<void> {
  if (!pushSupported()) return
  await PushNotifications.register().catch(warn('register'))
}

let syncedFor: string | null = null

/** 로그인 직후. 토큰이 바뀌었을 수 있어 사람마다 한 번 다시 등록한다 */
export async function syncPushToken(userId: string): Promise<void> {
  if (!pushSupported() || syncedFor === userId) return
  try {
    if ((await pushPermission()) !== 'granted') return
    if (!(await fetchPrefs())) return
    syncedFor = userId
    await startPush()
  } catch (err) {
    warn('sync')(err)
  }
}

/** 로그아웃·탈퇴 전에 — 이 폰으로 그 사람 알림이 더 가지 않게 */
export async function forgetPushToken(): Promise<void> {
  if (!pushSupported()) return
  const token = storedToken()
  if (!token) return
  try {
    await forgetToken(token)
    localStorage.removeItem(TOKEN_KEY)
    syncedFor = null
  } catch (err) {
    warn('토큰 지우기')(err)
  }
}
