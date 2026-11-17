// 이자 계산표(/cofix) 금리 달마다 받아오기 (2026-11-17)
//  - 코픽스(신규취급액): 네이버 증권 marketindex KRCOFIXMANF → src/lib/cofixData.json
//  - 금융채 5년: 신한은행 주요시장금리(#050906000000)의 매달 16일 값 → src/lib/bank5yData.json
//    신한 화면은 표를 직접 그려서 브라우저(Edge)로 열어 읽는다. playwright-core가 있는 폴더를 PW_DIR로 준다.
// 실행: PW_DIR=<playwright-core 폴더> node scripts/update-rates.mjs [--skip-bank]
// 결영 PC 작업 스케줄러가 매달 16~18일에 돌린다(가계부\빌드도구\금리_자동반영\run.ps1). 바뀐 게 없으면 파일을 안 건드린다.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const r3 = (n) => Math.round(n * 1000) / 1000
const r2 = (n) => Math.round(n * 100) / 100

function writeIfChanged(rel, obj) {
  const file = new URL(rel, import.meta.url)
  const next = JSON.stringify(obj, null, 2) + '\n'
  let prev = ''
  try {
    prev = readFileSync(file, 'utf-8')
  } catch {
    // 처음
  }
  // 윈도 git은 CRLF로 꺼내 놓으니 줄바꿈은 빼고 비교
  if (prev.replace(/\r\n/g, '\n') === next) return false
  writeFileSync(file, next)
  return true
}

// ── 코픽스
async function cofix() {
  const API =
    'https://api.stock.naver.com/marketindex/domesticInterest/KRCOFIXMANF/prices?page=1&pageSize=13'
  const res = await fetch(API, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`네이버 응답 ${res.status}`)
  const rows = await res.json()
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('코픽스 데이터가 비었어요')
  const months = rows
    .map((x) => ({
      published: String(x.localTradedAt).slice(0, 10),
      rate: Number(x.closePrice),
      change: Number(x.fluctuations) * (x.fluctuationsType?.name === 'FALLING' ? -1 : 1),
    }))
    .filter((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.published) && Number.isFinite(m.rate))
  // 앞 달과의 차이로 다시 센다 (내리면 음수)
  for (let i = 0; i < months.length - 1; i++) months[i].change = r3(months[i].rate - months[i + 1].rate)
  const changed = writeIfChanged('../src/lib/cofixData.json', { source: 'naver:KRCOFIXMANF', months })
  console.log('코픽스', changed ? '고침' : '그대로', months[0])
  return changed
}

// ── 금융채 5년 (신한은행)
async function bank5y() {
  const dir = process.env.PW_DIR
  if (!dir) throw new Error('PW_DIR(playwright-core 폴더)가 없어요')
  const { chromium } = createRequire(join(dir, 'package.json'))('playwright-core')

  const now = new Date(Date.now() + 9 * 3600_000) // 한국 시간
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  if (now.getUTCDate() < 16) throw new Error('16일 전이라 이번 달 값이 아직 없어요')
  const target = `${y}-${m}-16`

  const file = new URL('../src/lib/bank5yData.json', import.meta.url)
  const data = JSON.parse(readFileSync(file, 'utf-8'))
  if (data.months[0]?.date === target) {
    console.log('금융채 5년 그대로(이미 있음)', data.months[0])
    return false
  }

  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const page = await browser.newPage({ locale: 'ko-KR' })
    await page.goto('https://www.shinhan.com/hpe/index.jsp#050906000000', { waitUntil: 'networkidle' })
    const input = page.locator('#ica_fr_input')
    await input.waitFor({ timeout: 30_000 })
    await input.fill(target.replaceAll('-', '.'))
    await page.locator('a, button').filter({ hasText: /^\s*조회\s*$/ }).first().click()
    await page.waitForTimeout(3000)
    // 표 두 개 중 '금융채5년'이 첫 숫자 칸인 표의 맨 윗줄 = 16일(쉬는 날이면 그 앞 영업일)
    const row = await page.evaluate(() => {
      const t = [...document.querySelectorAll('table')].find((el) =>
        /금융채5년/.test(el.innerText),
      )
      const line = t?.innerText.split('\n').find((l) => /^\d{4}\.\d{2}\.\d{2}/.test(l.trim()))
      return line ? line.trim().split(/\s+/) : null
    })
    if (!row) throw new Error('신한 표를 못 읽었어요')
    const [day, rate5] = row
    const rate = Number(rate5)
    if (!Number.isFinite(rate) || rate <= 0 || rate > 20) throw new Error(`금융채 5년 값이 이상해요: ${rate5}`)
    if (day.replaceAll('.', '-') > target) throw new Error(`16일보다 뒤 날짜가 나왔어요: ${day}`)

    const prev = data.months[0]
    const entry = { date: target, rate, change: prev ? r2(r2(rate) - r2(prev.rate)) : 0 }
    data.months = [entry, ...data.months].slice(0, 24)
    writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
    console.log('금융채 5년 고침', entry, `(표 날짜 ${day})`)
    return true
  } finally {
    await browser.close()
  }
}

let failed = false
try {
  await cofix()
} catch (e) {
  failed = true
  console.error('코픽스 실패:', e.message)
}
if (!process.argv.includes('--skip-bank')) {
  try {
    await bank5y()
  } catch (e) {
    failed = true
    console.error('금융채 5년 실패:', e.message)
  }
}
process.exitCode = failed ? 1 : 0
