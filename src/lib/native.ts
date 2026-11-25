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
/** 앱 공유 창을 사용자가 닫았을 때 플러그인이 던지는 오류 (Share canceled) */
const cancelled = (err: unknown) => /cancell?ed/i.test(err instanceof Error ? err.message : String(err))

/** 공유 창 → 안 되면 복사. 사용자가 창을 닫은 것도 'shared'(조용히 끝낸다) */
export async function shareText(p: {
  text: string
  url?: string
  title?: string
}): Promise<'shared' | 'copied' | 'failed'> {
  if (isNative()) {
    try {
      await Share.share({ text: p.text, url: p.url, title: p.title })
      return 'shared'
    } catch (err) {
      if (cancelled(err)) return 'shared'
    }
  } else if (navigator.share) {
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
    } catch (err) {
      if (!cancelled(err)) return false
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
