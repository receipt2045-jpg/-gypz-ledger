import { beforeEach, describe, expect, it, vi } from 'vitest'

const isNativePlatform = vi.fn(() => false)
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => isNativePlatform() } }))
const nativeShare = vi.fn(async (_o: unknown) => ({}))
vi.mock('@capacitor/share', () => ({ Share: { share: (o: unknown) => nativeShare(o) } }))
const writeFile = vi.fn(async (_o: unknown) => ({ uri: 'file:///cache/x.png' }))
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: (o: unknown) => writeFile(o) },
  Directory: { Cache: 'CACHE' },
}))

import { isNative, saveFile, shareFile, shareText } from './native'

beforeEach(() => {
  isNativePlatform.mockReturnValue(false)
  Object.assign(navigator, { share: undefined, canShare: undefined })
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } })
})

describe('shareText', () => {
  it('앱이면 네이티브 공유 창을 쓴다', async () => {
    isNativePlatform.mockReturnValue(true)
    expect(isNative()).toBe(true)
    expect(await shareText({ text: '초대해요', url: 'https://moabuli.com/#/join/AB' })).toBe('shared')
    expect(nativeShare).toHaveBeenCalledWith({ text: '초대해요', url: 'https://moabuli.com/#/join/AB', title: undefined })
  })

  it('앱에서 사용자가 공유 창을 닫아도 shared로 조용히 끝낸다', async () => {
    isNativePlatform.mockReturnValue(true)
    nativeShare.mockRejectedValueOnce(new Error('Share canceled'))
    expect(await shareText({ text: 'a' })).toBe('shared')
  })

  it('웹에 navigator.share가 없으면 텍스트와 주소를 복사한다', async () => {
    expect(await shareText({ text: '보세요', url: 'https://x' })).toBe('copied')
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('보세요\nhttps://x')
  })

  it('웹에서 navigator.share가 있으면 그걸 쓴다', async () => {
    const share = vi.fn(async () => {})
    Object.assign(navigator, { share })
    expect(await shareText({ text: 't' })).toBe('shared')
    expect(share).toHaveBeenCalledWith({ text: 't', url: undefined, title: undefined })
  })
})

describe('shareFile / saveFile', () => {
  const file = new File(['png'], '모아불리-2026-10.png', { type: 'image/png' })

  it('앱이면 캐시에 쓰고 그 파일을 공유한다', async () => {
    isNativePlatform.mockReturnValue(true)
    expect(await shareFile(file, '성적표')).toBe('shared')
    expect(writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: '모아불리-2026-10.png', directory: 'CACHE' }),
    )
    expect(nativeShare).toHaveBeenCalledWith({ title: '성적표', files: ['file:///cache/x.png'] })
  })

  it('웹에서 파일 공유가 안 되면 다운로드한다', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    expect(await shareFile(file, '성적표')).toBe('saved')
    expect(click).toHaveBeenCalled()
    expect(await saveFile(file)).toBe('saved')
  })

  it('앱에서 saveFile은 공유 창으로 넘긴다', async () => {
    isNativePlatform.mockReturnValue(true)
    expect(await saveFile(file)).toBe('shared')
  })
})
