// 테스트 설정은 vitest.config.ts에 따로 있다 (여기 두면 rollup 타입과 충돌한다)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
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
    description:
      '금 처음 산다면, 수수료부터 보세요. 100만 원어치 사고팔면 얼마 떼이는지 비교했어요.',
    image: 'https://moabuli.com/og-gold.png?v=1',
  },
  {
    dir: 'coupang',
    title: '결영이네 쿠팡 꿀팁',
    description: '쿠팡에서 쓴 돈, 돌려받는 3가지. 최저가 알림부터 결제금액 2% 현금까지 정리했어요.',
    image: 'https://moabuli.com/og-coupang.png?v=1',
  },
  {
    dir: 'values',
    title: '결영이네 · 부부 재테크 가치관 체크리스트 50',
    description: '아내·남편이 각자 1~5점 매기고, 우리 부부 궁합과 생각이 먼 것부터 확인해 보세요. 소비·저축·통장·부수입·투자·대출까지 50가지.',
    image: 'https://moabuli.com/og-values.png?v=2',
  },
  {
    dir: 'survey',
    title: '결영이네 앱테크 · 커피값, AI 비서가 벌어와요',
    description: '기프티콘 주는 설문을 하루 2번 AI가 찾아서 대신 응모해요. 결영이네가 실제로 쓰는 명령어를 그대로 복사해 가세요.',
    image: 'https://moabuli.com/og-survey.png?v=1',
  },
  {
    dir: 'cofix',
    title: '코픽스 오르면, 우리집 이자는 얼마 더?',
    description: '남은 대출금과 금리만 넣으면 다음 금리변경일부터 한 달에 더 내는 이자를 바로 계산해요.',
    image: 'https://moabuli.com/og-cofix.png?v=1',
  },
  {
    dir: 'toothpaste',
    title: '결영이네 · 무불소 아기치약 10종 비교',
    description: '어린이집에 보낼 치약 10종을 성분·뚜껑·10g당 가격으로 비교했어요. 어린이집 양치 파우치 3종과 비교표 PDF까지.',
    image: 'https://moabuli.com/og-toothpaste.png?v=1',
  },
  {
    dir: 'recipes',
    title: '결영이네 집밥 레시피',
    description: '집에 있는 재료로 레시피를 고르면, 더 살 재료와 영양소까지 알려 줘요.',
    image: 'https://moabuli.com/og-recipes.png?v=1',
  },
]

// 머니툰 자료(src/lib/moneytoon/*.json, 2026-11-19) — 파일마다 moabuli.com/money/<slug> 미리보기를 저절로
const MT_DIR = join(process.cwd(), 'src/lib/moneytoon')
for (const f of existsSync(MT_DIR) ? readdirSync(MT_DIR).filter((x) => x.endsWith('.json')) : []) {
  const m = JSON.parse(readFileSync(join(MT_DIR, f), 'utf-8'))
  OG_PAGES.push({
    dir: `money/${m.slug}`,
    title: `${m.title} · 머니그랩 호랑이 눈높이 재테크`,
    description: m.description,
    image: 'https://moabuli.com/og-moneytoon.png?v=1',
  })
}
OG_PAGES.push({
  dir: 'money',
  title: '머니툰 자료 · 머니그랩 호랑이 눈높이 재테크',
  description: '인스타툰에서 약속한 정리본을 모아 뒀어요.',
  image: 'https://moabuli.com/og-moneytoon.png?v=1',
})

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
