// ── 엑셀 파일(.xlsx) 쓰고 읽기 (2026-11-23 부수입 내보내기·올리기) ──
// .xlsx는 XML 몇 장을 zip으로 묶은 것이다. 큰 라이브러리 대신 fflate(zip)만 쓰고 표 한 장만 다룬다.
// 쓰기: 글은 inlineStr, 숫자는 숫자 칸. 읽기: 첫 장, 공유 문자열, 날짜 서식 칸은 'YYYY-MM-DD'로.
import { strFromU8, strToU8 as rawU8, unzipSync, zipSync } from 'fflate'

/**
 * 글 → 바이트. TextEncoder가 돌려준 배열이 다른 창(realm)의 Uint8Array면 fflate가 파일을 폴더로 착각한다
 * (시험용 가짜 브라우저 jsdom에서 그랬다) — 이 창의 Uint8Array로 한 번 옮겨 담는다.
 */
const strToU8 = (s: string) => new Uint8Array(rawU8(s))

export type Cell = string | number | null | undefined

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // XML에 못 넣는 제어 문자
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')

/** 0 → A, 26 → AA */
export function colName(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** 표 한 장짜리 엑셀 — 첫 줄은 머리줄(굵게). widths는 글자 수 */
export function writeXlsx(
  rows: Cell[][],
  opts: { sheet?: string; widths?: number[] } = {},
): Uint8Array {
  const sheetName = esc((opts.sheet ?? 'Sheet1').slice(0, 31))
  const cols = opts.widths?.length
    ? `<cols>${opts.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`
    : ''
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((v, c) => {
          if (v === null || v === undefined || v === '') return ''
          const ref = `${colName(c)}${r + 1}`
          const style = r === 0 ? ' s="1"' : ''
          if (typeof v === 'number' && Number.isFinite(v))
            return `<c r="${ref}"${style}${r === 0 ? '' : ' s="2"'}><v>${v}</v></c>`
          return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`
        })
        .join('')
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join('')
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>',
    ),
    // 0 기본 · 1 머리줄 굵게 · 2 숫자 천 단위 쉼표
    'xl/styles.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
        '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        '</styleSheet>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        `${cols}<sheetData>${body}</sheetData></worksheet>`,
    ),
  }
  return zipSync(files, { level: 6 })
}

// ── 읽기 ──

const unesc = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')

/** <si>·<is> 안의 <t> 글을 모두 이어 붙인다 (서식 섞인 글 포함) */
const textOf = (xml: string) =>
  unesc([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''))

/** 'B12' → 1 */
function colIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '')
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/** 엑셀 날짜 숫자(1900 기준) → 'YYYY-MM-DD' */
export function excelDate(serial: number): string {
  const ms = Math.round((serial - 25569) * 86_400_000)
  return new Date(ms).toISOString().slice(0, 10)
}

const DATE_FMT_IDS = new Set([
  14, 15, 16, 17, 22, 27, 28, 29, 30, 31, 34, 35, 36, 45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57,
  58,
])

/** 첫 장을 글 표로 — 날짜 서식 칸은 'YYYY-MM-DD', 숫자는 숫자 글로 */
export function readXlsx(data: Uint8Array): string[][] {
  const zip = unzipSync(data)
  const read = (p: string) => (zip[p] ? strFromU8(zip[p]) : '')
  // 첫 장 경로
  const wb = read('xl/workbook.xml')
  const rels = read('xl/_rels/workbook.xml.rels')
  const firstId = wb.match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1]
  let target = firstId
    ? (rels.match(new RegExp(`<Relationship\\b[^>]*Id="${firstId}"[^>]*Target="([^"]+)"`))?.[1] ??
      rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${firstId}"`))?.[1])
    : undefined
  if (target) target = target.replace(/^\/?xl\//, '').replace(/^\//, '')
  const sheet = read(`xl/${target ?? 'worksheets/sheet1.xml'}`) || read('xl/worksheets/sheet1.xml')
  if (!sheet) throw new Error('엑셀 파일에서 표를 찾지 못했어요')

  const shared = [...read('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    textOf(m[1]),
  )
  // 날짜 서식 스타일 번호
  const styles = read('xl/styles.xml')
  const customDate = new Set(
    [...styles.matchAll(/<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)]
      .filter((m) => /[yd]/i.test(m[2].replace(/"[^"]*"|\[[^\]]*\]/g, '')))
      .map((m) => Number(m[1])),
  )
  const xfs = styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? ''
  const dateStyle = [...xfs.matchAll(/<xf\b([^>]*)\/?>/g)].map((m) => {
    const id = Number(m[1].match(/numFmtId="(\d+)"/)?.[1] ?? 0)
    return DATE_FMT_IDS.has(id) || customDate.has(id)
  })

  const rows: string[][] = []
  for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: string[] = []
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1]
      const inner = cm[2] ?? ''
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1]
      const t = attrs.match(/\bt="(\w+)"/)?.[1]
      const s = Number(attrs.match(/\bs="(\d+)"/)?.[1] ?? 0)
      const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      let text = ''
      if (t === 's') text = shared[Number(v)] ?? ''
      else if (t === 'inlineStr') text = textOf(inner)
      else if (t === 'str' || t === 'e') text = unesc(v ?? '')
      else if (t === 'b') text = v === '1' ? 'TRUE' : 'FALSE'
      else if (v !== undefined) {
        const n = Number(v)
        text = dateStyle[s] && Number.isFinite(n) ? excelDate(n) : String(Math.round(n * 100) / 100)
      }
      const at = ref ? colIndex(ref) : row.length
      while (row.length < at) row.push('')
      row[at] = text
    }
    rows.push(row)
  }
  return rows
}

/** CSV(따옴표 칸 포함) → 표. 한국어 엑셀이 저장한 CSV(EUC-KR)도 읽는다 */
export function readCsv(data: Uint8Array): string[][] {
  let text = new TextDecoder('utf-8').decode(data)
  if (text.includes('�')) {
    try {
      text = new TextDecoder('euc-kr').decode(data)
    } catch {
      /* 못 바꾸면 그대로 */
    }
  }
  text = text.replace(/^﻿/, '')
  const delim = text.split('\n')[0].includes('\t') ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === delim) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}
