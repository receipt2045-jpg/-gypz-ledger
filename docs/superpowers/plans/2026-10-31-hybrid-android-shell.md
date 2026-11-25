# 하이브리드 안드로이드 앱(1단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 플레이 스토어의 모아불리 앱(moabuli.app)을 TWA에서 Capacitor 하이브리드 앱으로 바꾸되, 화면과 기능은 지금과 똑같이 유지한다.

**Architecture:** Capacitor 8 안드로이드 껍데기가 `https://moabuli.com`을 불러온다(`server.url`). 웹 코드는 `src/lib/native.ts` 한 곳에서 `Capacitor.isNativePlatform()`으로 앱/웹을 갈라, 앱일 때만 공유·파일 저장·음성 인식·구글 로그인·뒤로가기·링크 열기를 네이티브 플러그인으로 바꿔 부른다. 웹 동작은 바뀌지 않는다.

**Tech Stack:** Vite + React 18 + TS, Supabase JS v2, Capacitor 8.6 (`@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/browser`, `@capacitor/share`, `@capacitor/filesystem`), `@capacitor-community/speech-recognition` 7.0.1, `@capgo/capacitor-social-login` 8.x, vitest + jsdom.

## Global Constraints

- 설계 문서: `docs/superpowers/specs/2026-10-31-hybrid-android-shell-design.md`
- 패키지명 `moabuli.app`, versionName `1.1.0`, versionCode `2`, minSdk 24 이상.
- 업로드 키: `C:\Users\recei\OneDrive\문서\Claude\Projects\가계부\android-signing\moabuli-upload.jks` (alias `upload`, 비밀번호는 같은 폴더 `키정보-비밀.txt`). **레포에 키·비밀번호를 넣지 않는다.**
- 빌드 도구: JDK 17 `%USERPROFILE%\android-build\jdk17`, Android SDK `%USERPROFILE%\android-build\sdk` (build-tools 34, platform 35 설치됨). gradle 실행 시 `NoDefaultCurrentDirectoryInExePath` 환경변수를 지운다.
- 웹(브라우저) 동작은 바꾸지 않는다. 모든 분기는 `isNative()`가 false일 때 기존 코드 경로를 탄다.
- 이 레포는 다른 세션도 동시에 커밋한다 → 커밋은 항상 `git commit -- <내 파일들>`로 경로를 지정한다.
- 운영 사이트 배포 = `git push origin main` (Cloudflare Pages 자동). 지금 플레이 심사 중(1.0.0)이므로 웹 변경은 화면을 깨지 않는 범위로만.
- 앱 문구는 결영 말투(짧은 존댓말, AI 톤 금지).
- `npm run build`(= tsc + eslint + vitest + vite build)가 통과해야 커밋한다.

## File Structure

| 파일 | 책임 |
|---|---|
| `src/lib/native.ts` (신규) | 앱/웹 판별, 텍스트 공유, 파일 공유·저장 |
| `src/lib/native.test.ts` (신규) | 위 함수 테스트 (Capacitor 모듈 mock) |
| `src/lib/nativeSpeech.ts` (신규) | 네이티브 음성 인식을 Confess의 `SpeechRecognitionLike` 모양으로 감싼 어댑터 |
| `src/lib/nativeSpeech.test.ts` (신규) | 어댑터 테스트 |
| `src/lib/nativeShell.ts` (신규) | 앱 시작 시 한 번: 뒤로가기, 앱 링크 열림, 외부 링크 가로채기 |
| `src/lib/nativeShell.test.ts` (신규) | 외부 링크 판별 테스트 |
| `src/lib/googleLogin.ts` (신규) | 앱: 네이티브 구글 로그인 → `signInWithIdToken`, 웹: 기존 OAuth |
| `src/pages/AuthConfirm.tsx` (신규) | `/auth/confirm?token_hash=&type=` 메일 링크 처리(verifyOtp) |
| `src/lib/invite.ts`, `leaveShare.ts`, `qna.ts`, `cardImage.ts`, `pages/AdminPosts.tsx`, `pages/ParentalLeave.tsx`, `pages/Settings.tsx` (수정) | `native.ts` 공유·저장 함수 사용 |
| `src/pages/Confess.tsx` (수정) | 앱이면 `nativeSpeech` 어댑터 사용 |
| `src/pages/Login.tsx` (수정) | 구글 버튼이 `googleLogin.ts` 호출 |
| `src/main.tsx` (수정) | `installNativeShell()` 호출 |
| `src/App.tsx` (수정) | `/auth/confirm` 라우트 |
| `capacitor.config.ts` (신규), `android/` (신규, Capacitor 생성) | 앱 껍데기 |
| `android/app/src/main/AndroidManifest.xml` (수정) | App Links intent-filter, 마이크 권한 |
| `android/app/build.gradle` (수정) | versionCode/Name, 서명 설정(키 경로는 `~/.gradle/gradle.properties`에서 읽음) |
| `android/app/src/main/assets/public/offline.html` | 오프라인 안내(빌드 시 복사) |

---

### Task 1: 공유·파일 저장을 앱/웹 공통 함수로

**Files:**
- Create: `src/lib/native.ts`, `src/lib/native.test.ts`
- Modify: `src/lib/invite.ts:36-55`, `src/lib/leaveShare.ts:95-114`, `src/lib/qna.ts:222-240`, `src/pages/AdminPosts.tsx:67-84`, `src/lib/cardImage.ts:140-162`, `src/pages/ParentalLeave.tsx:494-516`, `src/pages/Settings.tsx:160-169`
- Modify: `package.json` (deps)

**Interfaces:**
- Produces:
  - `isNative(): boolean`
  - `shareText(p: { text: string; url?: string; title?: string }): Promise<'shared' | 'copied' | 'failed'>` — 앱: `@capacitor/share`, 웹: `navigator.share` → 실패 시 클립보드(`text` + 줄바꿈 + `url`)
  - `shareFile(file: File, title: string): Promise<'shared' | 'saved' | 'failed'>` — 앱: Filesystem(Cache)에 쓰고 Share로 공유, 웹: `navigator.canShare({files})`면 share, 아니면 `<a download>`
  - `saveFile(file: File): Promise<'saved' | 'shared' | 'failed'>` — 앱: Filesystem(Cache)에 쓰고 Share 창(사용자가 '파일에 저장'/드라이브 선택), 웹: `<a download>`

- [ ] **Step 1: 의존성 설치**

```bash
npm i @capacitor/core@8.6.0 @capacitor/share@8.0.3 @capacitor/filesystem@8.1.5
```

- [ ] **Step 2: 실패하는 테스트 작성** — `src/lib/native.test.ts`

```ts
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
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/native.test.ts`
Expected: FAIL — `Failed to resolve import "./native"`

- [ ] **Step 4: 구현** — `src/lib/native.ts`

```ts
/**
 * 앱(Capacitor)과 웹을 가르는 곳 (2026-10-31, 하이브리드 1단계).
 * 앱 화면은 크롬이 아니라 안드로이드 웹뷰라 navigator.share·다운로드가 안 된다.
 * 앱일 때만 폰 기능을 부르고, 웹은 예전 그대로 간다.
 */
import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Directory, Filesystem } from '@capacitor/filesystem'

export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

const aborted = (err: unknown) => err instanceof DOMException && err.name === 'AbortError'

/** 공유 창 → 안 되면 복사. 사용자가 창을 닫은 것도 'shared'(조용히 끝낸다) */
export async function shareText(p: {
  text: string
  url?: string
  title?: string
}): Promise<'shared' | 'copied' | 'failed'> {
  if (isNative()) {
    try {
      await Share.share({ text: p.text, url: p.url, title: p.title })
    } catch {
      /* 닫은 것 */
    }
    return 'shared'
  }
  if (navigator.share) {
    try {
      await navigator.share({ text: p.text, url: p.url, title: p.title })
      return 'shared'
    } catch (err) {
      if (aborted(err)) return 'shared'
    }
  }
  try {
    await navigator.clipboard.writeText(p.url ? `${p.text}\n${p.url}` : p.text)
    return 'copied'
  } catch {
    return 'failed'
  }
}

async function toBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** 앱: 캐시 폴더에 써서 공유 창으로 넘긴다 (거기서 카톡·드라이브·파일 저장을 고른다) */
async function nativeShareFile(file: File, title: string): Promise<boolean> {
  try {
    const { uri } = await Filesystem.writeFile({
      path: file.name,
      data: await toBase64(file),
      directory: Directory.Cache,
    })
    try {
      await Share.share({ title, files: [uri] })
    } catch {
      /* 닫은 것 */
    }
    return true
  } catch {
    return false
  }
}

function download(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
}

/** 파일 공유 → 웹에서 안 되면 다운로드 */
export async function shareFile(file: File, title: string): Promise<'shared' | 'saved' | 'failed'> {
  if (isNative()) return (await nativeShareFile(file, title)) ? 'shared' : 'failed'
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (err) {
      if (aborted(err)) return 'shared'
    }
  }
  download(file)
  return 'saved'
}

/** 파일 저장 — 앱은 다운로드 폴더에 직접 못 쓰므로 공유 창에서 '저장'을 고르게 한다 */
export async function saveFile(file: File): Promise<'saved' | 'shared' | 'failed'> {
  if (isNative()) return (await nativeShareFile(file, file.name)) ? 'shared' : 'failed'
  download(file)
  return 'saved'
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run src/lib/native.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: 호출하는 곳 바꾸기** (반환값·문구는 그대로 둔다)

`src/lib/invite.ts` — `shareInvite` 본문을:
```ts
export async function shareInvite(code: string): Promise<'shared' | 'copied' | 'failed'> {
  return shareText({ text: inviteMessage(code) })
}
```
(파일 위에 `import { shareText } from './native'`)

`src/lib/leaveShare.ts` — `shareLeaveLink` 본문을:
```ts
  const url = leaveShareUrl(v, window.location.origin)
  return shareText({ title: '모아불리 육아휴직 계산기', text: SHARE_TEXT, url })
```
주의: 앱 안에서 `window.location.origin`은 `https://moabuli.com`이므로 그대로 둔다.

`src/lib/qna.ts` — `shareLink` 본문을 `return shareText({ text, url })`.

`src/pages/AdminPosts.tsx` — `shareKakao`를:
```ts
  const shareKakao = async () => {
    if (!posted) return
    const r = await shareText({ text: kakaoText(posted, withLink) })
    if (r === 'copied') setMsg('글을 복사했어요. 카톡방에 붙여넣어 주세요.')
    if (r === 'failed') setMsg('복사가 안 되는 브라우저예요.')
  }
```

`src/lib/cardImage.ts` — `shareCard` 본문을:
```ts
  const file = await cardToFile(d)
  if (!file) return 'failed'
  return shareFile(file, `${formatYmKorean(d.ym)} 우리집 성적표`)
```

`src/pages/ParentalLeave.tsx` — `ImageSheet`의 `onSave`를:
```ts
  const onSave = async () => {
    await shareFile(file, '모아불리 육아휴직 계산')
  }
```
그리고 더 이상 안 쓰는 `canShareFile`을 지운다(이미지 미리보기 `url`은 그대로 둔다).

`src/pages/Settings.tsx` — `handleExport`를:
```ts
  const handleExport = () => {
    const data = exportData()
    const name = `gypz-ledger-${new Date().toISOString().slice(0, 10)}.json`
    void saveFile(new File([JSON.stringify(data, null, 2)], name, { type: 'application/json' }))
  }
```

- [ ] **Step 7: 전체 확인**

Run: `npm run build`
Expected: tsc·eslint 오류 없음, vitest 전부 PASS(기존 invite/leaveShare/qna 테스트 포함), vite build 성공

- [ ] **Step 8: 커밋**

```bash
git commit -m "앱/웹 공통 공유·파일 저장 함수(native.ts) — 웹 동작은 그대로" -- package.json package-lock.json src/lib/native.ts src/lib/native.test.ts src/lib/invite.ts src/lib/leaveShare.ts src/lib/qna.ts src/pages/AdminPosts.tsx src/lib/cardImage.ts src/pages/ParentalLeave.tsx src/pages/Settings.tsx
```

---

### Task 2: 음성 소비 기록을 앱에서도

**Files:**
- Create: `src/lib/nativeSpeech.ts`, `src/lib/nativeSpeech.test.ts`
- Modify: `src/pages/Confess.tsx:84-110` (`speechRecognitionCtor`와 `SpeechRecognitionLike`를 export 가능한 모양으로)

**Interfaces:**
- Consumes: `isNative()` (Task 1)
- Produces: `class NativeSpeech implements SpeechRecognitionLike` — `lang`, `continuous`, `interimResults`, `onresult`, `onend`, `onerror`, `start()`, `stop()`. `start()`는 권한 요청 → `SpeechRecognition.start({ language: this.lang, maxResults: 1, partialResults: false, popup: false })` → `matches[0]`를 `onresult({ results: [[{ transcript }]] })`로 넘기고 `onend()`.
- `SpeechRecognitionLike`는 `src/lib/nativeSpeech.ts`로 옮겨 export하고 Confess가 import한다.

- [ ] **Step 1: 설치**

```bash
npm i @capacitor-community/speech-recognition@7.0.1
```

- [ ] **Step 2: 실패하는 테스트** — `src/lib/nativeSpeech.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest'

const start = vi.fn(async (_o: unknown) => ({ matches: ['커피 사천오백원'] }))
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

describe('NativeSpeech', () => {
  it('들은 말을 웹 음성 인식과 같은 모양으로 넘기고 끝낸다', async () => {
    const rec = new NativeSpeech()
    rec.lang = 'ko-KR'
    const got: string[] = []
    const ended = new Promise<void>((r) => (rec.onend = () => r()))
    rec.onresult = (ev) => got.push(ev.results[0][0].transcript)
    rec.start()
    await ended
    expect(start).toHaveBeenCalledWith({ language: 'ko-KR', maxResults: 1, partialResults: false, popup: false })
    expect(got).toEqual(['커피 사천오백원'])
  })

  it('마이크 권한을 거절하면 onerror 후 onend', async () => {
    requestPermissions.mockResolvedValueOnce({ speechRecognition: 'denied' })
    const rec = new NativeSpeech()
    const onerror = vi.fn()
    rec.onerror = onerror
    await new Promise<void>((r) => {
      rec.onend = () => r()
      rec.start()
    })
    expect(onerror).toHaveBeenCalled()
    expect(start).not.toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/nativeSpeech.test.ts`
Expected: FAIL — `Failed to resolve import "./nativeSpeech"`

- [ ] **Step 4: 구현** — `src/lib/nativeSpeech.ts`

```ts
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
    void SpeechRecognition.stop().catch(() => {})
  }

  private async run() {
    try {
      const perm = await SpeechRecognition.requestPermissions()
      if (perm.speechRecognition !== 'granted') throw new Error('denied')
      const { matches } = await SpeechRecognition.start({
        language: this.lang,
        maxResults: 1,
        partialResults: false,
        popup: false,
      })
      const transcript = matches?.[0]?.trim()
      if (transcript) this.onresult?.({ results: [[{ transcript }]] })
    } catch {
      this.onerror?.()
    } finally {
      this.onend?.()
    }
  }
}
```

- [ ] **Step 5: Confess 연결** — `src/pages/Confess.tsx`
  - 84~110행의 `interface SpeechRecognitionLike {…}` 정의를 지우고 위에 `import { NativeSpeech, type SpeechRecognitionLike } from '../lib/nativeSpeech'`, `import { isNative } from '../lib/native'` 추가.
  - `speechRecognitionCtor()` 첫 줄에 추가:
```ts
  if (isNative()) return NativeSpeech
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/lib/nativeSpeech.test.ts src/pages`
Expected: PASS (Confess 화면 테스트 포함)

- [ ] **Step 7: 커밋**

```bash
git commit -m "앱에서도 음성으로 소비 기록 — 폰 음성 인식을 웹 것과 같은 모양으로" -- package.json package-lock.json src/lib/nativeSpeech.ts src/lib/nativeSpeech.test.ts src/pages/Confess.tsx
```

---

### Task 3: 뒤로가기·외부 링크·앱 링크 열림

**Files:**
- Create: `src/lib/nativeShell.ts`, `src/lib/nativeShell.test.ts`
- Modify: `src/main.tsx` (렌더 직전 `installNativeShell()`), `package.json`

**Interfaces:**
- Consumes: `isNative()`
- Produces:
  - `isExternalUrl(href: string, origin?: string): boolean` — moabuli.com(및 www)·같은 origin이 아니고 http(s)면 true
  - `installNativeShell(): void` — 앱일 때만: `App.addListener('backButton', ({canGoBack}) => canGoBack ? history.back() : App.exitApp())`; `App.addListener('appUrlOpen', ({url}) => …)` 에서 moabuli.com 주소면 `location.href = url`; `document`에 capture 단계 click 리스너로 외부 `<a>`를 `Browser.open({ url })`; `window.open`을 감싸 외부 주소면 `Browser.open`.

- [ ] **Step 1: 설치**

```bash
npm i @capacitor/app@8.1.2 @capacitor/browser@8.0.5
```

- [ ] **Step 2: 실패하는 테스트** — `src/lib/nativeShell.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest'
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(), exitApp: vi.fn() } }))
vi.mock('@capacitor/browser', () => ({ Browser: { open: vi.fn() } }))
import { isExternalUrl } from './nativeShell'

describe('isExternalUrl', () => {
  const o = 'https://moabuli.com'
  it.each([
    ['https://oneteamm.netlify.app', true],
    ['https://tally.so/r/abc', true],
    ['https://open.kakao.com/o/x', true],
    ['https://moabuli.com/#/info', false],
    ['https://www.moabuli.com/privacy', false],
    ['#/settings', false],
    ['/privacy', false],
    ['mailto:receipt2045@gmail.com', false],
  ])('%s → %s', (href, ext) => {
    expect(isExternalUrl(href, o)).toBe(ext)
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/nativeShell.test.ts`
Expected: FAIL — import 실패

- [ ] **Step 4: 구현** — `src/lib/nativeShell.ts`

```ts
/**
 * 앱 껍데기 동작 (2026-10-31, 하이브리드 1단계). 웹에선 아무것도 하지 않는다.
 * - 폰 뒤로가기: 앱 안 이전 화면, 첫 화면이면 앱 닫기
 * - 메일 링크 등으로 moabuli.com 주소가 앱을 열면 그 화면으로
 * - 원팀·상담 신청서·카톡 같은 바깥 링크는 앱 밖 브라우저로
 */
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { isNative } from './native'

const OUR_HOSTS = new Set(['moabuli.com', 'www.moabuli.com'])

export function isExternalUrl(href: string, origin = window.location.origin): boolean {
  let u: URL
  try {
    u = new URL(href, origin)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  if (u.origin === origin) return false
  return !OUR_HOSTS.has(u.hostname)
}

export function installNativeShell(): void {
  if (!isNative()) return

  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else void App.exitApp()
  })

  void App.addListener('appUrlOpen', ({ url }) => {
    if (!isExternalUrl(url)) window.location.href = url
  })

  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || !isExternalUrl(a.href)) return
      e.preventDefault()
      void Browser.open({ url: a.href })
    },
    true,
  )

  const open = window.open.bind(window)
  window.open = (url?: string | URL, target?: string, features?: string) => {
    const href = url?.toString() ?? ''
    if (href && isExternalUrl(href)) {
      void Browser.open({ url: href })
      return null
    }
    return open(url, target, features)
  }
}
```

- [ ] **Step 5: main.tsx 연결** — `src/main.tsx` 서비스 워커 등록 블록 앞에:

```ts
import { installNativeShell } from './lib/nativeShell'
// 앱(하이브리드)일 때만 뒤로가기·바깥 링크·앱 링크를 처리한다
installNativeShell()
```
그리고 서비스 워커 등록 조건을 `import.meta.env.PROD && 'serviceWorker' in navigator && !isNative()`로 바꾼다(앱에선 오프라인을 앱이 처리; `import { isNative } from './lib/native'`).

- [ ] **Step 6: 통과 확인**

Run: `npm run build`
Expected: 전부 PASS

- [ ] **Step 7: 커밋**

```bash
git commit -m "앱 껍데기 동작: 뒤로가기, 바깥 링크는 브라우저로, 앱 링크 열림" -- package.json package-lock.json src/lib/nativeShell.ts src/lib/nativeShell.test.ts src/main.tsx
```

---

### Task 4: 메일 링크를 moabuli.com에서 직접 처리 (앱으로 열리게)

지금 가입 확인·비밀번호 재설정 메일 링크는 `…supabase.co/auth/v1/verify?…`라 앱 링크(moabuli.com)에 안 걸린다. 링크를 `https://moabuli.com/auth/confirm?token_hash=…&type=…`로 바꾸고 화면에서 `verifyOtp`로 처리한다. 웹에서도 똑같이 동작한다.

**Files:**
- Create: `src/pages/AuthConfirm.tsx`, `src/pages/AuthConfirm.screen.test.tsx`
- Modify: `src/App.tsx` (로그인 없이 열리는 라우트 목록 근처, 56~70행), `src/lib/pathToHash.ts`(필요 시 `/auth/confirm` → `#/auth/confirm` 변환 확인)
- Supabase 대시보드: Authentication → Email Templates (Confirm signup, Reset password, Magic link) 링크 변경 — 결영 계정으로 크롬에서

**Interfaces:**
- Consumes: `supabase` (`src/lib/supabase.ts`)
- Produces: 라우트 `/auth/confirm` — 쿼리 `token_hash`, `type`(`signup`|`recovery`|`email`|`magiclink`)을 읽어 `supabase.auth.verifyOtp({ token_hash, type })` → 성공: `recovery`면 `#/settings`(비밀번호 바꾸기 안내), 그 외 `#/` ; 실패: "링크가 만료됐어요. 다시 요청해 주세요." + 로그인으로 버튼

- [ ] **Step 1: 실패하는 화면 테스트** — `src/pages/AuthConfirm.screen.test.tsx`

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const verifyOtp = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: { auth: { verifyOtp: (o: unknown) => verifyOtp(o) } } }))
import AuthConfirm from './AuthConfirm'

const at = (q: string) =>
  render(
    <MemoryRouter initialEntries={[`/auth/confirm?${q}`]}>
      <Routes>
        <Route path="/auth/confirm" element={<AuthConfirm />} />
        <Route path="/" element={<p>홈 화면</p>} />
      </Routes>
    </MemoryRouter>,
  )

describe('AuthConfirm', () => {
  it('가입 확인 링크를 처리하고 홈으로 보낸다', async () => {
    verifyOtp.mockResolvedValueOnce({ error: null })
    at('token_hash=abc&type=signup')
    await waitFor(() => expect(screen.getByText('홈 화면')).toBeInTheDocument())
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'signup' })
  })

  it('만료된 링크면 안내한다', async () => {
    verifyOtp.mockResolvedValueOnce({ error: { message: 'expired' } })
    at('token_hash=old&type=recovery')
    expect(await screen.findByText('링크가 만료됐어요. 다시 요청해 주세요.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/pages/AuthConfirm.screen.test.tsx`
Expected: FAIL — import 실패

- [ ] **Step 3: 구현** — `src/pages/AuthConfirm.tsx`

```tsx
/**
 * 메일 링크 처리 (2026-10-31). 메일 링크를 moabuli.com으로 바꿔야 앱이 바로 열린다.
 * Supabase 메일 템플릿: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup (재설정은 type=recovery)
 */
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export default function AuthConfirm() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const token_hash = params.get('token_hash')
    const type = params.get('type') as EmailOtpType | null
    if (!token_hash || !type) {
      setFailed(true)
      return
    }
    void supabase.auth.verifyOtp({ token_hash, type }).then(({ error }) => {
      if (error) setFailed(true)
      else navigate(type === 'recovery' ? '/settings' : '/', { replace: true })
    })
  }, [params, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 text-center">
      {failed ? (
        <div>
          <p className="text-[16px] font-bold text-ink">링크가 만료됐어요. 다시 요청해 주세요.</p>
          <button className="mt-4 text-brand underline" onClick={() => navigate('/', { replace: true })}>
            로그인 화면으로
          </button>
        </div>
      ) : (
        <p className="text-[15px] text-sub">확인하는 중이에요…</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 라우트 연결** — `src/App.tsx` 로그인 없이 열리는 공개 라우트들(`/legal/:doc` 옆)에 `<Route path="/auth/confirm" element={<AuthConfirm />} />` 추가. `src/lib/pathToHash.ts`가 `/auth/confirm?…` 경로를 `#/auth/confirm?…`로 옮기는지 `src/lib/pathToHash.test.ts`에 케이스 추가:

```ts
  it('메일 링크 /auth/confirm 쿼리를 해시로 옮긴다', () => {
    expect(hashFromPath('/auth/confirm', '?token_hash=a&type=signup', '')).toBe('/#/auth/confirm?token_hash=a&type=signup')
  })
```
(실패하면 `pathToHash.ts`의 허용 경로 목록에 `auth/confirm`을 추가하고 쿼리를 해시 뒤로 붙인다 — 기존 `/leave`, `/news` 처리 방식과 같은 줄에.)

- [ ] **Step 5: 통과 확인**

Run: `npm run build`
Expected: 전부 PASS

- [ ] **Step 6: 커밋·배포**

```bash
git commit -m "메일 링크를 moabuli.com/auth/confirm에서 처리 — 앱으로 바로 열리게" -- src/pages/AuthConfirm.tsx src/pages/AuthConfirm.screen.test.tsx src/App.tsx src/lib/pathToHash.ts src/lib/pathToHash.test.ts
git push origin main
```
배포 확인: `curl -sL https://moabuli.com/auth/confirm | grep -o "<title>[^<]*"` → 앱 index.html

- [ ] **Step 7: Supabase 메일 템플릿 변경 (크롬, 결영 로그인 상태)**
  - Authentication → Email Templates
  - Confirm signup 링크: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
  - Reset password 링크: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
  - Magic link(쓰는 경우): `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink`
  - Site URL이 `https://moabuli.com`인지 확인.
  - 확인: 테스트 이메일로 비밀번호 재설정 → 웹에서 링크 열어 설정 화면으로 가는지.

---

### Task 5: 구글 로그인을 앱 전용 방식으로

**Files:**
- Create: `src/lib/googleLogin.ts`, `src/lib/googleLogin.test.ts`
- Modify: `src/pages/Login.tsx:91-101`, `package.json`
- 콘솔(크롬, 결영 계정): Google Cloud OAuth 클라이언트, Supabase Google provider

**Interfaces:**
- Consumes: `isNative()`, `supabase`, `stashMarketingChoice`
- Produces: `loginWithGoogle(redirectTo: string): Promise<{ error: string | null }>` — 앱: `SocialLogin.initialize({ google: { webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID } })`(한 번) → `SocialLogin.login({ provider: 'google', options: {} })` → `result.idToken`으로 `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`; 웹: 기존 `signInWithOAuth({ provider:'google', options:{ redirectTo } })`

- [ ] **Step 1: 콘솔 준비 (크롬)**
  1. Supabase 대시보드 → Authentication → Providers → Google에서 지금 쓰는 **Client ID(웹)** 를 확인해 적어 둔다.
  2. Google Cloud 콘솔(같은 프로젝트) → API 및 서비스 → 사용자 인증 정보 → OAuth 클라이언트 ID 만들기 → **Android**, 패키지 `moabuli.app`, SHA-1 = 플레이 앱 서명 키 SHA-1(Play Console → 앱 서명 페이지). 같은 방식으로 업로드 키 SHA-1용 Android 클라이언트도 하나 더(`keytool -list -v -keystore …moabuli-upload.jks -alias upload`로 SHA-1 확인).
  3. Supabase Google provider의 **Authorized Client IDs**에 웹 Client ID를 넣고, "Skip nonce check"는 끈 상태 유지(플러그인이 nonce 없이 보내면 켠다 — Step 6에서 실제로 확인).
  4. `.env.local`과 Cloudflare Pages 환경변수에 `VITE_GOOGLE_WEB_CLIENT_ID=<웹 Client ID>` 추가.

- [ ] **Step 2: 설치**

```bash
npm i @capgo/capacitor-social-login@8.7.5
```

- [ ] **Step 3: 실패하는 테스트** — `src/lib/googleLogin.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
const native = vi.fn(() => false)
vi.mock('./native', () => ({ isNative: () => native() }))
const signInWithOAuth = vi.fn(async (_o: unknown) => ({ error: null }))
const signInWithIdToken = vi.fn(async (_o: unknown) => ({ error: null }))
vi.mock('./supabase', () => ({
  supabase: { auth: { signInWithOAuth: (o: unknown) => signInWithOAuth(o), signInWithIdToken: (o: unknown) => signInWithIdToken(o) } },
}))
const initialize = vi.fn(async (_o: unknown) => {})
const login = vi.fn(async (_o: unknown) => ({ result: { idToken: 'ID.TOKEN' } }))
vi.mock('@capgo/capacitor-social-login', () => ({
  SocialLogin: { initialize: (o: unknown) => initialize(o), login: (o: unknown) => login(o) },
}))
import { loginWithGoogle } from './googleLogin'

beforeEach(() => native.mockReturnValue(false))

describe('loginWithGoogle', () => {
  it('웹은 예전처럼 구글 페이지로 보낸다', async () => {
    await loginWithGoogle('https://moabuli.com/')
    expect(signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'https://moabuli.com/' } })
  })

  it('앱은 폰의 구글 계정으로 받은 토큰으로 로그인한다', async () => {
    native.mockReturnValue(true)
    expect(await loginWithGoogle('x')).toEqual({ error: null })
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'ID.TOKEN' })
  })

  it('앱에서 계정 선택 창을 닫으면 에러 없이 끝낸다', async () => {
    native.mockReturnValue(true)
    login.mockRejectedValueOnce(new Error('canceled'))
    expect(await loginWithGoogle('x')).toEqual({ error: null })
    expect(signInWithIdToken).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: 실패 확인**

Run: `npx vitest run src/lib/googleLogin.test.ts`
Expected: FAIL — import 실패

- [ ] **Step 5: 구현** — `src/lib/googleLogin.ts`

```ts
/**
 * 구글 로그인 (2026-10-31). 앱 웹뷰 안에서는 구글이 웹 로그인 화면을 막는다.
 * 앱은 폰의 구글 계정 선택 창 → ID 토큰 → Supabase, 웹은 예전처럼 리디렉션.
 */
import { SocialLogin } from '@capgo/capacitor-social-login'
import { isNative } from './native'
import { supabase } from './supabase'

let ready: Promise<void> | null = null

export async function loginWithGoogle(redirectTo: string): Promise<{ error: string | null }> {
  if (!isNative()) {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    return { error: error?.message ?? null }
  }
  ready ??= SocialLogin.initialize({ google: { webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID } })
  await ready
  let idToken: string | undefined
  try {
    const res = await SocialLogin.login({ provider: 'google', options: {} })
    idToken = (res.result as { idToken?: string }).idToken
  } catch {
    return { error: null } // 창을 닫은 것
  }
  if (!idToken) return { error: '구글 로그인 정보를 받지 못했어요.' }
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })
  return { error: error?.message ?? null }
}
```

- [ ] **Step 6: Login.tsx 연결** — `loginWithGoogle` 핸들러 이름이 겹치므로 import를 `import { loginWithGoogle as googleSignIn } from '../lib/googleLogin'`로 하고:

```ts
  const loginWithGoogle = async () => {
    setError('')
    stashMarketingChoice(marketing)
    const { error: err } = await googleSignIn(redirectTo)
    if (err) setError(koError(err))
  }
```
`src/vite-env.d.ts`에 `readonly VITE_GOOGLE_WEB_CLIENT_ID: string` 추가.

- [ ] **Step 7: 통과 확인**

Run: `npm run build`
Expected: 전부 PASS (Login 화면 테스트 포함 — 기존 테스트의 `signInWithOAuth` mock 호출 인자가 같은지 확인)

- [ ] **Step 8: 커밋·배포**

```bash
git commit -m "구글 로그인: 앱은 폰 계정 선택 창, 웹은 그대로" -- package.json package-lock.json src/lib/googleLogin.ts src/lib/googleLogin.test.ts src/pages/Login.tsx src/vite-env.d.ts
git push origin main
```

---

### Task 6: Capacitor 안드로이드 프로젝트 만들고 서명된 앱 빌드

**Files:**
- Create: `capacitor.config.ts`, `android/` (생성), `android/app/src/main/assets/public/index.html`·`offline.html`
- Modify: `android/app/src/main/AndroidManifest.xml`, `android/app/build.gradle`, `android/variables.gradle`, `.gitignore`
- Create(레포 밖): `%USERPROFILE%\.gradle\gradle.properties` — 서명 정보

**Interfaces:**
- Consumes: Task 1~5의 웹 코드가 운영(moabuli.com)에 배포돼 있어야 앱에서 동작한다.
- Produces: `android/app/build/outputs/bundle/release/app-release.aab`, `android/app/build/outputs/apk/release/app-release.apk` (versionCode 2, 1.1.0, 업로드 키 서명)

- [ ] **Step 1: 설치·설정**

```bash
npm i @capacitor/android@8.6.0 && npm i -D @capacitor/cli@8.6.0
```

`capacitor.config.ts`:
```ts
import type { CapacitorConfig } from '@capacitor/cli'

// 앱은 moabuli.com을 불러온다 — 사이트를 배포하면 앱 화면도 바뀐다 (설계: docs/superpowers/specs/2026-10-31-…)
const config: CapacitorConfig = {
  appId: 'moabuli.app',
  appName: '모아불리',
  webDir: 'android-web',
  server: {
    url: 'https://moabuli.com/?src=app#/',
    errorPath: 'offline.html',
    allowNavigation: ['moabuli.com', 'www.moabuli.com', '*.supabase.co'],
  },
  android: { backgroundColor: '#F2F4F6' },
}
export default config
```
`android-web/index.html`(최소 파일, server.url이 있으면 쓰이지 않음)과 `android-web/offline.html`(= `public/offline.html` 복사, 이미지 src를 `icons/icon-192.png` 상대경로로 + 아이콘 복사)을 만든다.

- [ ] **Step 2: 안드로이드 프로젝트 생성**

```bash
npx cap add android && npx cap sync android
```
Expected: `android/` 생성, 플러그인 6개(app, browser, share, filesystem, speech-recognition, social-login) 등록 로그

- [ ] **Step 3: AndroidManifest** — `<activity android:name=".MainActivity" …>` 안에 추가:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="moabuli.com" />
</intent-filter>
```
`<manifest>` 바로 안에 `<uses-permission android:name="android.permission.RECORD_AUDIO" />` 와 음성 인식 서비스 조회용
```xml
<queries>
    <intent><action android:name="android.speech.RecognitionService" /></intent>
</queries>
```

- [ ] **Step 4: 버전·서명** — `android/app/build.gradle`의 `defaultConfig`: `versionCode 2`, `versionName "1.1.0"`. `android { … }` 안에:

```gradle
signingConfigs {
    release {
        storeFile file(MOABULI_STORE_FILE)
        storePassword MOABULI_STORE_PASSWORD
        keyAlias 'upload'
        keyPassword MOABULI_STORE_PASSWORD
    }
}
buildTypes { release { signingConfig signingConfigs.release } }
```
레포 밖 `%USERPROFILE%\.gradle\gradle.properties`에 (비밀번호는 `키정보-비밀.txt`에서 읽어 셸로 써 넣는다 — 대화·커밋에 출력하지 않는다):
```
MOABULI_STORE_FILE=C:/Users/recei/OneDrive/문서/Claude/Projects/가계부/android-signing/moabuli-upload.jks
MOABULI_STORE_PASSWORD=<키정보-비밀.txt의 비밀번호>
```
`android/variables.gradle`의 `minSdkVersion`이 24 이상인지 확인.

- [ ] **Step 5: 빌드**

```bash
cd android
export JAVA_HOME="$USERPROFILE/android-build/jdk17" ANDROID_HOME="$USERPROFILE/android-build/sdk"
env -u NoDefaultCurrentDirectoryInExePath cmd //c "gradlew.bat bundleRelease assembleRelease"
```
Expected: `BUILD SUCCESSFUL`, `app-release.aab`·`app-release.apk` 생성.
확인: `"$JAVA_HOME/bin/keytool" -printcert -jarfile app/build/outputs/apk/release/app-release.apk | grep SHA256` → `4F:DC:A1:…:B9:0C`(업로드 키).
산출물을 `가계부/play-store/build/moabuli-1.1.0.aab`, `moabuli-1.1.0.apk`로 복사.

- [ ] **Step 6: 커밋** (android/ 빌드 산출물은 `.gitignore`)

`.gitignore`에 `android/app/build/`, `android/.gradle/`, `android/local.properties` 추가(이미 Capacitor가 넣었으면 생략).
```bash
git add capacitor.config.ts android-web android .gitignore
git commit -m "Capacitor 안드로이드 앱 껍데기 (moabuli.app 1.1.0) — moabuli.com을 불러온다" -- capacitor.config.ts android-web android .gitignore package.json package-lock.json
```

---

### Task 7: 폰에서 확인하고 내부 테스트 → 프로덕션

**Files:** 없음(Play Console·폰)

- [ ] **Step 1: 결영 갤럭시에 APK 설치** — 내부 테스트 트랙에 `moabuli-1.1.0.aab` 올리고 테스터에 receipt2045@gmail.com 추가 → 결영이 테스트 링크로 설치. (이미 1.0.0 TWA를 깔았으면 업데이트로 깔림.)

- [ ] **Step 2: 체크리스트 (결영과 함께, 각 항목 결과 기록)**
  1. 이메일 로그인 / 로그아웃
  2. 구글 로그인(폰 계정 선택 창이 뜨는지)
  3. 새 이메일로 가입 → 확인 메일 링크 → 앱이 열리고 로그인되는지
  4. 비밀번호 재설정 메일 링크 → 앱 설정 화면
  5. 원팀프로젝트·상담 신청서·카톡 링크 → 앱 밖 브라우저
  6. 폰 뒤로가기(화면 몇 개 들어갔다 나오기, 첫 화면에서 앱 종료)
  7. 비행기 모드로 앱 열기 → 안내 화면
  8. 음성으로 소비 기록(마이크 권한 묻는지 → 말한 게 입력되는지)
  9. 초대 링크·성적표 카드·육아휴직·묻고 답하기 공유 → 카톡 공유 창
  10. 설정 → 데이터 내보내기 → 공유 창에서 저장
  11. 주식 기록 사진 올리기
  12. 화면 위(상태바)·아래(내비게이션바)가 가리지 않는지

- [ ] **Step 3: 문제 수정** — 웹 문제는 해당 Task 파일 수정·배포, 앱 껍데기 문제는 versionCode 올려 다시 빌드.

- [ ] **Step 4: 프로덕션 (1.0.0 승인 후, 결영 확인 받고)** — 프로덕션 트랙 새 버전에 1.1.0 AAB, 출시 노트:

```
<ko-KR>
앱이 더 빨라지고, 음성 기록·공유가 앱 안에서 바로 돼요.
업데이트 후 한 번만 다시 로그인해 주세요. 가계부 기록은 그대로 있어요.
</ko-KR>
```
게시 개요에서 심사 제출은 결영 확인 후 누른다.
