import { describe, expect, it, vi } from 'vitest'
import { buildFcmBody, createFcmSender, isInvalidToken, runPool, sendToUser, signJwt, type ServiceAccount } from './fcm.ts'

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
  it('UNREGISTERED와, 등록 토큰을 가리키는 INVALID_ARGUMENT만 지울 토큰', () => {
    expect(isInvalidToken(404, unregistered.json)).toBe(true)
    expect(
      isInvalidToken(400, {
        error: { status: 'INVALID_ARGUMENT', message: 'The registration token is not a valid FCM registration token' },
      }),
    ).toBe(true)
    expect(
      isInvalidToken(400, {
        error: {
          status: 'INVALID_ARGUMENT',
          message: 'Request contains an invalid argument.',
          details: [{ '@type': 'type.googleapis.com/google.rpc.BadRequest', fieldViolations: [{ field: 'message.token' }] }],
        },
      }),
    ).toBe(true)
  })
  it('본문 오류·이유 없는 INVALID_ARGUMENT·NOT_FOUND는 지우지 않는다', () => {
    expect(isInvalidToken(400, { error: { status: 'INVALID_ARGUMENT' } })).toBe(false)
    expect(isInvalidToken(400, { error: { status: 'INVALID_ARGUMENT', details: [{ errorCode: 'INVALID_ARGUMENT' }] } })).toBe(false)
    expect(
      isInvalidToken(400, {
        error: {
          status: 'INVALID_ARGUMENT',
          message: 'Invalid value at message.data',
          details: [{ fieldViolations: [{ field: 'message.data[0].value' }] }],
        },
      }),
    ).toBe(false)
    expect(isInvalidToken(404, { error: { status: 'NOT_FOUND' } })).toBe(false)
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

describe('runPool', () => {
  it('동시에 limit개까지만 돌리고, 던진 건은 onError로 넘기며 나머지는 끝낸다', async () => {
    let running = 0
    let peak = 0
    const done: number[] = []
    const errors: number[] = []
    await runPool(
      [1, 2, 3, 4, 5, 6, 7],
      3,
      async (n) => {
        running++
        peak = Math.max(peak, running)
        await new Promise((r) => setTimeout(r, 5))
        running--
        if (n === 4) throw new Error('boom')
        done.push(n)
      },
      (n) => errors.push(n),
    )
    expect(peak).toBe(3)
    expect(done.sort()).toEqual([1, 2, 3, 5, 6, 7])
    expect(errors).toEqual([4])
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

  it('본문 잘못(INVALID_ARGUMENT)은 토큰을 지우지 않고 error', async () => {
    const { sa } = await testAccount()
    const f = fakeFetch(() => ({ status: 400, json: { error: { status: 'INVALID_ARGUMENT', message: 'Invalid value at message.data' } } }))
    expect(await createFcmSender(sa, f).send('tok', msg)).toBe('error')
  })

  it('ready는 OAuth 실패를 던지고(상태만), 성공하면 한 번만 받는다', async () => {
    const { sa } = await testAccount()
    const bad = vi.fn(async () => new Response('{}', { status: 401 }))
    await expect(createFcmSender(sa, bad).ready()).rejects.toThrow('google oauth 401')
    const f = fakeFetch(() => ({ status: 200 }))
    const sender = createFcmSender(sa, f)
    await sender.ready()
    await sender.send('tok', msg)
    expect(f.mock.calls.filter(([u]) => u === 'https://oauth2.googleapis.com/token')).toHaveLength(1)
  })

  it('FCM·OAuth 호출에는 제한 시간 signal이 붙는다', async () => {
    const { sa } = await testAccount()
    const f = fakeFetch(() => ({ status: 200 }))
    await createFcmSender(sa, f).send('tok', msg)
    for (const [, init] of f.mock.calls) expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('OAuth가 실패하면 던지지 않고 error', async () => {
    const { sa } = await testAccount()
    const f = vi.fn(async () => new Response('{}', { status: 401 }))
    expect(await createFcmSender(sa, f).send('tok', msg)).toBe('error')
  })
})
