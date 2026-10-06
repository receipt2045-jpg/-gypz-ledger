// 테스트 설정은 vitest.config.ts에 따로 있다 (여기 두면 rollup 타입과 충돌한다)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * moabuli.com/news 링크 미리보기 (2026-10-06).
 * 카톡은 링크 화면의 글을 읽지 않고 index.html의 og 태그만 본다. 앱은 화면이 하나(index.html)라
 * 뉴스 링크도 앱 카드로 떴다. 빌드할 때 og 태그만 바꾼 news/index.html을 하나 더 만든다.
 * 열면 앱이 그대로 뜨고, pathToHash가 /news → /#/news로 옮긴다.
 */
const NEWS_OG = {
  title: '결영이네 오늘의 경제',
  description: '톡방에 올린 경제 뉴스와 증시 정리를 날짜별로 모아 봐요.',
  image: 'https://moabuli.com/og-news.png?v=1',
  url: 'https://moabuli.com/news',
}

function newsOgHtml(html: string): string {
  const set = (attr: string, key: string, value: string) => {
    const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`)
    if (!re.test(html)) throw new Error(`index.html에 ${key} 태그가 없어요`)
    html = html.replace(re, `$1${value}$2`)
  }
  set('property', 'og:title', NEWS_OG.title)
  set('property', 'og:description', NEWS_OG.description)
  set('property', 'og:image', NEWS_OG.image)
  set('property', 'og:url', NEWS_OG.url)
  set('name', 'description', NEWS_OG.description)
  set('name', 'twitter:title', NEWS_OG.title)
  set('name', 'twitter:description', NEWS_OG.description)
  set('name', 'twitter:image', NEWS_OG.image)
  return html.replace(/<title>[^<]*<\/title>/, `<title>${NEWS_OG.title}</title>`)
}

function newsOgPage(): Plugin {
  let outDir = 'dist'
  return {
    name: 'news-og-page',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    closeBundle() {
      const html = readFileSync(join(outDir, 'index.html'), 'utf-8')
      mkdirSync(join(outDir, 'news'), { recursive: true })
      writeFileSync(join(outDir, 'news', 'index.html'), newsOgHtml(html))
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  // 커스텀 도메인 루트(moabuli.com/)에서 서비스한다.
  // 예전 기본값은 GitHub Pages용 '/gypz-ledger/'였는데, 그 배포는 더 이상 없고
  // 호스팅을 옮길 때마다 경로가 깨져서 기본값을 '/'로 바꿨다.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), newsOgPage()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
})
