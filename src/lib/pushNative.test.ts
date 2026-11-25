import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  native: false,
  plugin: true,
  handlers: {} as Record<string, (e: unknown) => void>,
  addListener: vi.fn(),
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  register: vi.fn(),
  createChannel: vi.fn(),
  registerToken: vi.fn(),
  forgetToken: vi.fn(),
  fetchPrefs: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => h.native, isPluginAvailable: () => h.plugin },
}))
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    addListener: (name: string, fn: (e: unknown) => void) => {
      h.handlers[name] = fn
      h.addListener(name)
      return Promise.resolve({ remove: async () => {} })
    },
    checkPermissions: () => h.checkPermissions(),
    requestPermissions: () => h.requestPermissions(),
    register: () => h.register(),
    createChannel: (o: unknown) => h.createChannel(o),
  },
}))
vi.mock('./pushPrefs', () => ({
  registerToken: (t: string) => h.registerToken(t),
  forgetToken: (t: string) => h.forgetToken(t),
  fetchPrefs: () => h.fetchPrefs(),
}))

async function load() {
  vi.resetModules()
  return import('./pushNative')
}

beforeEach(() => {
  h.native = false
  h.plugin = true
  h.handlers = {}
  h.checkPermissions.mockResolvedValue({ receive: 'granted' })
  h.requestPermissions.mockResolvedValue({ receive: 'granted' })
  h.register.mockResolvedValue(undefined)
  h.createChannel.mockResolvedValue(undefined)
  h.registerToken.mockResolvedValue(undefined)
  h.forgetToken.mockResolvedValue(undefined)
  h.fetchPrefs.mockResolvedValue({ reminderOn: true })
  localStorage.clear()
  window.location.hash = ''
})

describe('웹에서는 아무것도 안 한다', () => {
  it('리스너·권한·등록 모두 건너뛴다', async () => {
    const m = await load()
    m.installPush()
    expect(h.addListener).not.toHaveBeenCalled()
    expect(await m.pushPermission()).toBe('denied')
    expect(await m.askPushPermission()).toBe(false)
    await m.syncPushToken('u1')
    await m.forgetPushToken()
    expect(h.checkPermissions).not.toHaveBeenCalled()
    expect(h.register).not.toHaveBeenCalled()
    expect(h.forgetToken).not.toHaveBeenCalled()
  })
  it('플러그인이 없는 옛 앱(1.1.0)도 건너뛴다', async () => {
    h.native = true
    h.plugin = false
    const m = await load()
    expect(m.pushSupported()).toBe(false)
    m.installPush()
    expect(h.addListener).not.toHaveBeenCalled()
  })
})

describe('앱', () => {
  beforeEach(() => {
    h.native = true
  })

  it('채널을 만들고, 받은 토큰을 등록하고 기억한다', async () => {
    const m = await load()
    m.installPush()
    m.installPush() // 두 번 불러도 한 번만
    expect(h.createChannel).toHaveBeenCalledTimes(1)
    expect(h.createChannel).toHaveBeenCalledWith({ id: 'moabuli', name: '모아불리 알림', importance: 4 })
    h.handlers.registration({ value: 'tok-123' })
    expect(h.registerToken).toHaveBeenCalledWith('tok-123')
    expect(localStorage.getItem('pushToken')).toBe('tok-123')
  })

  it('알림을 누르면 그 화면으로 간다', async () => {
    const m = await load()
    m.installPush()
    h.handlers.pushNotificationActionPerformed({ notification: { data: { path: '/confess' } } })
    expect(window.location.hash).toBe('#/confess')
  })

  it('바깥 주소·이상한 경로는 무시한다', async () => {
    const m = await load()
    expect(m.safePath('/info/abc')).toBe('/info/abc')
    expect(m.safePath('https://evil.example')).toBeNull()
    expect(m.safePath('//evil.example')).toBeNull()
    expect(m.safePath('confess')).toBeNull()
    expect(m.safePath(undefined)).toBeNull()
    m.openFromNotification({ path: 'https://evil.example' })
    expect(window.location.hash).toBe('')
  })

  it('권한 상태를 세 가지로 돌려준다', async () => {
    const m = await load()
    h.checkPermissions.mockResolvedValueOnce({ receive: 'prompt-with-rationale' })
    expect(await m.pushPermission()).toBe('prompt')
    h.checkPermissions.mockResolvedValueOnce({ receive: 'denied' })
    expect(await m.pushPermission()).toBe('denied')
    h.requestPermissions.mockResolvedValueOnce({ receive: 'denied' })
    expect(await m.askPushPermission()).toBe(false)
  })

  it('로그인 후: 권한이 있고 설정을 만든 사람만, 사람마다 한 번 등록', async () => {
    const m = await load()
    await m.syncPushToken('u1')
    await m.syncPushToken('u1')
    expect(h.register).toHaveBeenCalledTimes(1)

    h.fetchPrefs.mockResolvedValueOnce(null)
    await m.syncPushToken('u2')
    expect(h.register).toHaveBeenCalledTimes(1)

    h.checkPermissions.mockResolvedValueOnce({ receive: 'denied' })
    await m.syncPushToken('u3')
    expect(h.register).toHaveBeenCalledTimes(1)
  })

  it('로그아웃 때 이 폰 토큰을 지운다', async () => {
    const m = await load()
    localStorage.setItem('pushToken', 'tok-123')
    await m.forgetPushToken()
    expect(h.forgetToken).toHaveBeenCalledWith('tok-123')
    expect(localStorage.getItem('pushToken')).toBeNull()
  })
})
