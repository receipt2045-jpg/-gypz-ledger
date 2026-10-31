/**
 * 앱 웹뷰엔 웹 음성 인식(Web Speech API)이 없다 (2026-10-31).
 * 폰 음성 인식 플러그인을 웹 것과 같은 모양으로 감싸서, 소비 기록 화면은 그대로 쓴다.
 */
import { SpeechRecognition } from '@capacitor-community/speech-recognition'

export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

// 플러그인(안드로이드)이 "말이 없었음 / 못 알아들음"을 reject 메시지로 알려 준다.
// 사용자가 아무 말도 안 한 경우라 오류로 띄우지 않고 조용히 끝낸다.
const QUIET_ENDINGS = /no speech input|no match/i

export class NativeSpeech implements SpeechRecognitionLike {
  lang = 'ko-KR'
  continuous = false
  interimResults = false
  onresult: SpeechRecognitionLike['onresult'] = null
  onend: SpeechRecognitionLike['onend'] = null
  onerror: SpeechRecognitionLike['onerror'] = null

  start() {
    void this.run()
  }

  stop() {
    SpeechRecognition.stop().catch((e) => console.warn('음성 인식 중지 실패', e))
  }

  private async run() {
    try {
      const perm = await SpeechRecognition.requestPermissions()
      if (perm.speechRecognition !== 'granted') throw new Error('마이크 권한이 없어요')
      const { matches } = await SpeechRecognition.start({
        language: this.lang,
        maxResults: 1,
        partialResults: false,
        popup: false,
      })
      const transcript = matches?.[0]?.trim()
      if (transcript) this.onresult?.({ results: [[{ transcript }]] })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (!QUIET_ENDINGS.test(msg)) {
        console.warn('음성 인식 실패', e)
        this.onerror?.()
      }
    } finally {
      this.onend?.()
    }
  }
}
