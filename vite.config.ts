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
 * 금테크 정리(moabuli.com/gold)도 같은 방식 (2026-10-24).
 */
interface OgPage {
  /** 폴더 이름 = 주소 */
  dir: string
  title: string
  description: string
  image: string
}

const OG_PAGES: OgPage[] = [
  {
    dir: 'news',
    title: '결영이네 오늘의 경제',
    description: '톡방에 올린 경제 뉴스와 증시 정리를 날짜별로 모아 봐요.',
    image: 'https://moabuli.com/og-news.png?v=1',
  },
  {
    dir: 'gold',
    title: '결영이네 금테크 정리',
    description: '금 처음 산다면, 수수료부터 보세요. 100만 원어치 사고팔면 얼마 떼이는지 비교했어요.',
    image: 'https://moabuli.com/og-gold.png?v=1',
  },
]

function ogHtml(html: string, page: OgPage): string {
  const url = `https://moabuli.com/${page.dir}`
  const set = (attr: string, key: string, value: string) => {
    const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`)
    if (!re.test(html)) throw new Error(`index.html에 ${key} 태그가 없어요`)
    html = html.replace(re, `$1${value}$2`)
  }
  set('property', 'og:title', page.title)
  set('property', 'og:description', page.description)
  set('property', 'og:image', page.image)
  set('property', 'og:url', url)
  set('name', 'description', page.description)
  set('name', 'twitter:title', page.title)
  set('name', 'twitter:description', page.description)
  set('name', 'twitter:image', page.image)
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
  return html.replace(/<title>[^<]*<\/title>/, `<title>${page.title}</title>`)
}

function ogPages(): Plugin {
  let outDir = 'dist'
  return {
    name: 'og-pages',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    closeBundle() {
      const html = readFileSync(join(outDir, 'index.html'), 'utf-8')
      for (const page of OG_PAGES) {
        mkdirSync(join(outDir, page.dir), { recursive: true })
        writeFileSync(join(outDir, page.dir, 'index.html'), ogHtml(html, page))
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  // 커스텀 도메인 루트(moabuli.com/)에서 서비스한다.
  // 예전 기본값은 GitHub Pages용 '/gypz-ledger/'였는데, 그 배포는 더 이상 없고
  // 호스팅을 옮길 때마다 경로가 깨져서 기본값을 '/'로 바꿨다.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), ogPages()],
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
