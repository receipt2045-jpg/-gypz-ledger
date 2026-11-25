import { beforeEach, describe, expect, it, vi } from 'vitest'

const start = vi.fn(async (_o: unknown): Promise<{ matches?: string[] }> => ({ matches: ['커피 사천오백원'] }))
const requestPermissions = vi.fn(async () => ({ speechRecognition: 'granted' }))
const stop = vi.fn(async () => {})
vi.mock('@capacitor-community/speech-recognition', () => ({
  SpeechRecognition: {
    start: (o: unknown) => start(o),
    requestPermissions: () => requestPermissions(),
    stop: () => stop(),
  },
}))

import { NativeSpeech } from './nativeSpeech'

beforeEach(() => {
  vi.clearAllMocks()
})

function run(rec: NativeSpeech) {
  return new Promise<void>((r) => {
    rec.onend = () => r()
    rec.start()
  })
}

describe('NativeSpeech', () => {
  it('들은 말을 웹 음성 인식과 같은 모양으로 넘기고 끝낸다', async () => {
    const rec = new NativeSpeech()
    rec.lang = 'ko-KR'
    const got: string[] = []
    const onerror = vi.fn()
    rec.onresult = (ev) => got.push(ev.results[0][0].transcript)
    rec.onerror = onerror
    await run(rec)
    expect(start).toHaveBeenCalledWith({ language: 'ko-KR', maxResults: 1, partialResults: false, popup: false })
    expect(got).toEqual(['커피 사천오백원'])
    expect(onerror).not.toHaveBeenCalled()
  })

  it('마이크 권한을 거절하면 음성 인식을 시작하지 않고 onerror 후 onend', async () => {
    requestPermissions.mockResolvedValueOnce({ speechRecognition: 'denied' })
    const rec = new NativeSpeech()
    const onerror = vi.fn()
    rec.onerror = onerror
    await run(rec)
    expect(onerror).toHaveBeenCalledTimes(1)
    expect(start).not.toHaveBeenCalled()
  })

  it('아무 말도 안 했을 때(No speech input)는 오류로 알리지 않고 조용히 끝낸다', async () => {
    start.mockRejectedValueOnce(new Error('No speech input'))
    const rec = new NativeSpeech()
    const onerror = vi.fn()
    const onresult = vi.fn()
    rec.onerror = onerror
    rec.onresult = onresult
    await run(rec)
    expect(onerror).not.toHaveBeenCalled()
    expect(onresult).not.toHaveBeenCalled()
  })

  it('알아듣지 못했을 때(No match)도 조용히 끝낸다', async () => {
    start.mockRejectedValueOnce('No match')
    const rec = new NativeSpeech()
    const onerror = vi.fn()
    rec.onerror = onerror
    await run(rec)
    expect(onerror).not.toHaveBeenCalled()
  })

  it('네트워크 같은 진짜 실패는 onerror로 알린다', async () => {
    start.mockRejectedValueOnce(new Error('Network error'))
    const rec = new NativeSpeech()
    const onerror = vi.fn()
    rec.onerror = onerror
    await run(rec)
    expect(onerror).toHaveBeenCalledTimes(1)
  })

  it('빈 결과는 onresult를 부르지 않는다', async () => {
    start.mockResolvedValueOnce({ matches: ['  '] })
    const rec = new NativeSpeech()
    const onresult = vi.fn()
    rec.onresult = onresult
    await run(rec)
    expect(onresult).not.toHaveBeenCalled()
  })

  it('stop은 플러그인 stop을 부르고, 실패하면 콘솔에 남긴다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    stop.mockRejectedValueOnce(new Error('boom'))
    new NativeSpeech().stop()
    await vi.waitFor(() => expect(warn).toHaveBeenCalled())
    expect(stop).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
