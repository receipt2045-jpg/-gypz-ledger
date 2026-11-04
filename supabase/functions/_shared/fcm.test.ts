import { describe, expect, it, vi } from 'vitest'
import { buildFcmBody, createFcmSender, isInvalidToken, sendToUser, signJwt, type ServiceAccount } from './fcm.ts'

async function testAccount(): Promise<{ sa: ServiceAccount; publicKey: CryptoKey }> {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', pair.privateKey)).toString('base64')
  const pem = `-----BEGIN PRIVATE KEY-----\n${der.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`
  return {
    sa: { project_id: 'moabuli-test', client_email: 'push@moabuli-test.iam.gserviceaccount.com', private_key: pem },
    publicKey: pair.publicKey,
  }
}

const b64urlDecode = (s: string) => new Uint8Array(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'))

/** 구글 OAuth와 FCM을 흉내 낸다. fcm(token)이 그 토큰에 대한 응답을 정한다 */
function fakeFetch(fcm: (token: string) => { status: number; json?: unknown }) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'ya29.test', expires_in: 3600 }), { status: 200 })
    }
    const token = JSON.parse(String(init?.body)).message.token as string
    const r = fcm(token)
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status })
  })
}

const msg = { title: '오늘 기록할 시간이에요', body: '쓴 돈 30초면 남겨요.', path: '/confess' }
const unregistered = { status: 404, json: { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } } }

describe('buildFcmBody', () => {
  it('알림·이동할 화면·안드로이드 채널을 담는다', () => {
    expect(buildFcmBody('tok', msg)).toEqual({
      message: {
        token: 'tok',
        notification: { title: msg.title, body: msg.body },
        data: { path: '/confess' },
        android: { priority: 'HIGH', notification: { channel_id: 'moabuli', icon: 'ic_stat_moabuli' } },
      },
    })
  })
})

describe('isInvalidToken', () => {
  it('UNREGISTERED·INVALID_ARGUMENT는 지울 토큰', () => {
    expect(isInvalidToken(404, unregistered.json)).toBe(true)
    expect(isInvalidToken(400, { error: { status: 'INVALID_ARGUMENT' } })).toBe(true)
    expect(isInvalidToken(400, { error: { status: 'INVALID_ARGUMENT', details: [{ errorCode: 'INVALID_ARGUMENT' }] } })).toBe(true)
  })
  it('일시 오류는 지우지 않는다', () => {
    expect(isInvalidToken(500, { error: { status: 'INTERNAL' } })).toBe(false)
    expect(isInvalidToken(429, { error: { status: 'RESOURCE_EXHAUSTED' } })).toBe(false)
    expect(isInvalidToken(503, null)).toBe(false)
  })
})

describe('signJwt', () => {
  it('서비스 계정 키로 RS256 서명한 FCM 범위 토큰을 만든다', async () => {
    const { sa, publicKey } = await testAccount()
    const jwt = await signJwt(sa, 1_800_000_000)
    const [h, c, s] = jwt.split('.')
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(h)))).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(c)))).toEqual({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    })
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, b64urlDecode(s), new TextEncoder().encode(`${h}.${c}`))
    expect(ok).toBe(true)
  })
})

describe('createFcmSender / sendToUser', () => {
  it('OAuth 토큰은 한 번만 받고, v1 주소로 Bearer와 함께 보낸다', async () => {
    const { sa } = await testAccount()
    const f = fakeFetch(() => ({ status: 200, json: { name: 'projects/moabuli-test/messages/1' } }))
    const sender = createFcmSender(sa, f)
    expect(await sender.send('tok-a', msg)).toBe('ok')
    expect(await sender.send('tok-b', msg)).toBe('ok')
    const calls = f.mock.calls.map(([url]) => url)
    expect(calls.filter((u) => u === 'https://oauth2.googleapis.com/token')).toHaveLength(1)
    const [url, init] = f.mock.calls[1]
    expect(url).toBe('https://fcm.googleapis.com/v1/projects/moabuli-test/messages:send')
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer ya29.test')
  })

  it('사람의 폰 여러 대: 성공·무효·일시 오류를 나눠 센다', async () => {
    const { sa } = await testAccount()
    const f = fakeFetch((t) => (t === 'gone-token' ? unregistered : t === 'flaky-token' ? { status: 503 } : { status: 200 }))
    const r = await sendToUser(createFcmSender(sa, f), ['good-token', 'gone-token', 'flaky-token'], msg)
    expect(r).toEqual({ ok: 1, errors: 1, invalid: ['gone-token'] })
  })

  it('OAuth가 실패하면 던지지 않고 error', async () => {
    const { sa } = await testAccount()
    const f = vi.fn(async () => new Response('{}', { status: 401 }))
    expect(await createFcmSender(sa, f).send('tok', msg)).toBe('error')
  })
})
