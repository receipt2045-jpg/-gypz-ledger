#!/usr/bin/env node
// 모아불리 앱 AI 리뷰 — Hugging Face Inference Providers 사용
//
//   HF_TOKEN=hf_xxx node scripts/review.mjs [관점]
//
// 관점: ux(기본) | copy | code | security | all
// 결과는 화면에 출력되고 review/ 폴더에 마크다운으로 저장됩니다.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * HF 토큰 찾기 — 채팅·코드에 토큰을 적지 않아도 되도록 여러 위치를 순서대로 확인.
 * 1) HF_TOKEN 환경변수
 * 2) hf CLI 로그인 토큰 (hf auth login 하면 여기 저장됨)
 * 3) 프로젝트 .hf-token 파일 (gitignore 처리됨)
 */
function findToken() {
  if (process.env.HF_TOKEN?.trim()) return process.env.HF_TOKEN.trim()

  const candidates = [
    path.join(os.homedir(), '.cache', 'huggingface', 'token'),
    path.join(os.homedir(), '.huggingface', 'token'),
    path.join(ROOT, '.hf-token'),
  ]
  for (const p of candidates) {
    try {
      const t = fs.readFileSync(p, 'utf8').trim()
      if (t) return t
    } catch {
      /* 다음 후보 확인 */
    }
  }
  return null
}
const HF_URL = 'https://router.huggingface.co/v1/chat/completions'
const MODEL = process.env.HF_MODEL ?? 'Qwen/Qwen3-235B-A22B-Instruct-2507'

// ── 관점별 대상 파일과 지시문 ──────────────────
const FOCUS = {
  ux: {
    label: 'UX·사용성',
    files: ['src/pages', 'src/components'],
    ask: `이 앱의 화면 흐름과 사용성을 평가해줘. 특히:
- 가계부를 처음 써보는 30~40대 부부가 헤맬 지점
- 단계가 너무 많거나 중간에 포기할 만한 흐름
- 정보 구조(무엇이 어디 있는지)가 직관적인지
- 빈 화면·오류 상황 대응이 충분한지`,
  },
  copy: {
    label: '카피·톤',
    files: ['src/pages', 'src/components', 'src/lib/reactions.ts', 'src/lib/roadmap.ts'],
    ask: `이 앱의 문구(카피)를 평가해줘. 브랜드는 '결영이네'이고 톤은 짧고 정돈된 존댓말이야.
단, 마스코트 '모아/불리'의 잔소리 대사는 일부러 반말 팩폭 톤이야. 특히:
- AI가 쓴 것처럼 밋밋하거나 뻔한 문장
- 초보자가 이해 못 할 금융 용어
- 톤이 튀거나 일관되지 않은 곳
- 더 구체적으로 바꾸면 좋을 추상적 표현`,
  },
  code: {
    label: '코드 품질',
    files: ['src/lib', 'src/components', 'src/App.tsx'],
    ask: `이 코드의 품질과 유지보수성을 평가해줘. 특히:
- 버그가 날 수 있는 로직(계산·상태·비동기)
- 중복되거나 한 곳으로 모아야 할 코드
- 타입이 느슨해서 위험한 부분
- 성능 문제(불필요한 재계산·렌더)`,
  },
  security: {
    label: '보안·프라이버시',
    files: ['src/lib/db.ts', 'src/lib/store.ts', 'src/lib/supabase.ts', 'src/pages/Login.tsx', 'supabase'],
    ask: `이 앱의 보안과 개인정보 처리를 평가해줘. 가계부 앱이라 재무 데이터를 다뤄. 특히:
- 데이터 접근 제어(RLS 정책)에 구멍이 있는지
- 키·비밀값이 클라이언트에 노출되는지
- 인증 흐름의 허점
- 남의 가구 데이터를 볼 수 있는 경로가 있는지`,
  },
}

const EXT = new Set(['.ts', '.tsx', '.sql'])
const SKIP = new Set(['node_modules', 'dist', '.git'])

function collect(target, out = []) {
  const abs = path.join(ROOT, target)
  if (!fs.existsSync(abs)) return out
  const stat = fs.statSync(abs)
  if (stat.isFile()) {
    if (EXT.has(path.extname(abs))) out.push(target)
    return out
  }
  for (const name of fs.readdirSync(abs)) {
    if (SKIP.has(name)) continue
    collect(path.join(target, name), out)
  }
  return out
}

async function main() {
  const focusKey = (process.argv[2] ?? 'ux').toLowerCase()
  const keys = focusKey === 'all' ? Object.keys(FOCUS) : [focusKey]

  if (!keys.every((k) => FOCUS[k])) {
    console.error(`관점을 골라주세요: ${Object.keys(FOCUS).join(' | ')} | all`)
    process.exit(1)
  }
  const token = findToken()
  if (!token) {
    console.error(`허깅페이스 토큰을 찾지 못했어요. 아래 중 하나로 준비해 주세요.

  1) 파일로 저장 (권장)
     gypz-ledger/.hf-token 파일에 토큰만 한 줄로 저장

  2) 환경변수
     HF_TOKEN=hf_xxx node scripts/review.mjs ux

  3) hf CLI 로그인
     hf auth login`)
    process.exit(1)
  }

  fs.mkdirSync(path.join(ROOT, 'review'), { recursive: true })

  for (const key of keys) {
    const focus = FOCUS[key]
    const files = [...new Set(focus.files.flatMap((f) => collect(f)))]

    const bundle = files
      .map((f) => `\n===== ${f} =====\n${fs.readFileSync(path.join(ROOT, f), 'utf8')}`)
      .join('\n')

    console.log(`\n[${focus.label}] 파일 ${files.length}개 · ${Math.round(bundle.length / 1000)}KB 전송 중…`)

    const system = `너는 한국 모바일 웹앱을 검토하는 시니어 제품 리뷰어다.
'모아불리'는 부부가 함께 쓰는 가계부 앱이다(React + TypeScript + Supabase, 모바일 웹).
실제 사용자 30여 명이 쓰고 있고, 앞으로 유료 상담 상품과 연결할 예정이다.

칭찬은 짧게, 문제는 구체적으로 지적한다. 파일명과 근거를 반드시 함께 쓴다.
막연한 조언("UX를 개선하세요") 대신 무엇을 어떻게 바꿀지 쓴다. 한국어로 답한다.`

    const user = `${focus.ask}

아래 형식으로 정리해줘. 마크다운 사용 가능.

## 한 줄 총평

## 잘된 점 (3개 이내)

## 문제점 (심각한 순, 최대 7개)
각 항목: 무엇이 문제인지 / 어느 파일인지 / 어떻게 고칠지

## 지금 당장 고칠 것 3가지
우선순위 순으로, 바로 실행 가능하게

---
아래는 소스 코드다.
${bundle}`

    const res = await fetch(HF_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 3000,
        temperature: 0.4,
      }),
    })

    if (!res.ok) {
      console.error(`실패 (HTTP ${res.status})`, (await res.text()).slice(0, 500))
      continue
    }

    const json = await res.json()
    const text = (json.choices?.[0]?.message?.content ?? '')
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .trim()

    const outPath = path.join(ROOT, 'review', `${key}.md`)
    fs.writeFileSync(outPath, `# ${focus.label} 리뷰\n\n모델: ${MODEL}\n\n${text}\n`)

    console.log(`\n${'='.repeat(60)}\n[${focus.label}]\n${'='.repeat(60)}\n`)
    console.log(text)
    console.log(`\n→ 저장됨: review/${key}.md`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
