/**
 * FCM HTTP v1 발송 (2026-11-04, 푸시 2단계).
 * 서비스 계정 JSON(시크릿 FIREBASE_SERVICE_ACCOUNT)으로 OAuth 토큰을 만들어 부른다.
 * Deno(push-dispatch)와 vitest가 같이 쓴다 → Deno 전용 import 금지. fetch·crypto.subtle만 쓴다.
 * 토큰·키 값은 로그에 남기지 않는다.
 */

/** 앱 src/lib/pushNative.ts의 채널, AndroidManifest의 기본 채널과 같아야 한다 */
export const CHANNEL_ID = 'moabuli'
/** android/app/src/main/res/drawable/ic_stat_moabuli.xml */
export const SMALL_ICON = 'ic_stat_moabuli'

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

export interface FcmMessage {
  title: string
  body: string
  path: string
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>
export type SendResult = 'ok' | 'invalid' | 'error'

export interface FcmSender {
  send(token: string, m: FcmMessage): Promise<SendResult>
}

export function buildFcmBody(token: string, m: FcmMessage) {
  return {
    message: {
      token,
      notification: { title: m.title, body: m.body },
      data: { path: m.path },
      android: { priority: 'HIGH', notification: { channel_id: CHANNEL_ID, icon: SMALL_ICON } },
    },
  }
}

/** 지워야 할 토큰(앱 삭제·만료·잘못된 값)인지. 그 외 실패는 일시 오류로 본다 */
export function isInvalidToken(status: number, json: unknown): boolean {
  const err = (json as { error?: { status?: string; details?: { errorCode?: string }[] } } | null)?.error
  const codes = (err?.details ?? []).map((d) => d.errorCode)
  if (codes.includes('UNREGISTERED') || codes.includes('INVALID_ARGUMENT')) return true
  return (status === 404 && err?.status === 'NOT_FOUND') || (status === 400 && err?.status === 'INVALID_ARGUMENT')
}

const enc = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function pemToDer(pem: string): ArrayBuffer {
  const bin = atob(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out.buffer
}

export async function signJwt(sa: ServiceAccount, nowSec: number): Promise<string> {
  const header = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const claims = b64url(
    enc.encode(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600 })),
  )
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${header}.${claims}`)))
  return `${header}.${claims}.${b64url(sig)}`
}

export function createFcmSender(
  sa: ServiceAccount,
  fetchFn: FetchLike = fetch,
  nowSec: () => number = () => Math.floor(Date.now() / 1000),
): FcmSender {
  let access: Promise<string> | null = null

  const getAccess = (): Promise<string> => {
    if (!access) {
      access = (async () => {
        const res = await fetchFn(TOKEN_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: await signJwt(sa, nowSec()),
          }).toString(),
        })
        if (!res.ok) throw new Error(`google oauth ${res.status}`)
        return ((await res.json()) as { access_token: string }).access_token
      })()
      access.catch(() => {
        access = null // 다음 send에서 다시 시도
      })
    }
    return access
  }

  return {
    async send(token, m) {
      try {
        const res = await fetchFn(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
          method: 'POST',
          headers: { authorization: `Bearer ${await getAccess()}`, 'content-type': 'application/json' },
          body: JSON.stringify(buildFcmBody(token, m)),
        })
        if (res.ok) return 'ok'
        const json = await res.json().catch(() => null)
        return isInvalidToken(res.status, json) ? 'invalid' : 'error'
      } catch {
        return 'error'
      }
    },
  }
}

/** 한 사람의 폰 전부에 보낸다. 일시 오류는 다시 보내지 않는다(중복보다 누락이 낫다) */
export async function sendToUser(
  sender: FcmSender,
  tokens: string[],
  m: FcmMessage,
): Promise<{ ok: number; errors: number; invalid: string[] }> {
  const out = { ok: 0, errors: 0, invalid: [] as string[] }
  for (const t of tokens) {
    const r = await sender.send(t, m)
    if (r === 'ok') out.ok++
    else if (r === 'invalid') out.invalid.push(t)
    else out.errors++
  }
  return out
}
