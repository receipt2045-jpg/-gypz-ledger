import { describe, expect, it } from 'vitest'
import { strToU8 as rawU8, zipSync } from 'fflate'
const strToU8 = (t: string) => new Uint8Array(rawU8(t))
import { colName, excelDate, readCsv, readXlsx, writeXlsx } from './xlsx'

describe('엑셀 파일 쓰고 읽기 (2026-11-23)', () => {
  it('쓴 표를 그대로 다시 읽는다 — 한글·특수문자·숫자', () => {
    const rows = [
      ['날짜', '구분', '종류', '금액', '메모'],
      ['2026-11-03', '번 돈', '앱테크', 32000, '캐시워크 <출금> & "정산"'],
      ['2026-11-05', '쓴 돈', '수수료', 1500, ''],
    ]
    const back = readXlsx(writeXlsx(rows, { sheet: '부수입', widths: [12, 8, 14, 12, 30] }))
    expect(back[0]).toEqual(['날짜', '구분', '종류', '금액', '메모'])
    expect(back[1]).toEqual(['2026-11-03', '번 돈', '앱테크', '32000', '캐시워크 <출금> & "정산"'])
    expect(back[2].slice(0, 4)).toEqual(['2026-11-05', '쓴 돈', '수수료', '1500'])
  })

  it('엑셀이 만든 파일 — 공유 문자열·날짜 서식 칸·빈 칸 건너뛰기', () => {
    const files = {
      'xl/workbook.xml': strToU8(
        '<workbook xmlns:r="r"><sheets><sheet name="a" sheetId="1" r:id="rId3"/></sheets></workbook>',
      ),
      'xl/_rels/workbook.xml.rels': strToU8(
        '<Relationships><Relationship Id="rId3" Type="x" Target="worksheets/sheet9.xml"/></Relationships>',
      ),
      'xl/sharedStrings.xml': strToU8(
        '<sst><si><t>날짜</t></si><si><r><t>앱</t></r><r><t>테크</t></r></si></sst>',
      ),
      'xl/styles.xml': strToU8(
        '<styleSheet><numFmts><numFmt numFmtId="176" formatCode="yyyy&quot;년&quot; m&quot;월&quot; d&quot;일&quot;"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="176"/></cellXfs></styleSheet>',
      ),
      'xl/worksheets/sheet9.xml': strToU8(
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row>' +
          '<row r="2"><c r="A2" s="1"><v>46329</v></c><c r="C2" t="s"><v>1</v></c><c r="D2"><v>32000</v></c></row>' +
          '<row r="3"><c r="A3" s="2"><v>46330</v></c></row></sheetData></worksheet>',
      ),
    }
    const back = readXlsx(zipSync(files))
    expect(back[0]).toEqual(['날짜'])
    expect(back[1]).toEqual(['2026-11-03', '', '앱테크', '32000'])
    expect(back[2]).toEqual(['2026-11-04'])
  })

  it('CSV — 따옴표 칸·쉼표 금액, 한국어 엑셀 CSV(EUC-KR)', () => {
    const utf8 = strToU8('날짜,종류,금액\n11/3,앱테크,"32,000"\r\n11/4,"수수료, 카드",1500\n')
    expect(readCsv(utf8)).toEqual([
      ['날짜', '종류', '금액'],
      ['11/3', '앱테크', '32,000'],
      ['11/4', '수수료, 카드', '1500'],
    ])
    // '앱테크' EUC-KR
    const euc = new Uint8Array([0xbe, 0xdb, 0xc5, 0xd7, 0xc5, 0xa9, 0x2c, 0x31, 0x0a])
    expect(readCsv(euc)[0]).toEqual(['앱테크', '1'])
  })

  it('칸 이름·날짜 숫자', () => {
    expect([colName(0), colName(25), colName(26)]).toEqual(['A', 'Z', 'AA'])
    expect(excelDate(46329)).toBe('2026-11-03')
  })
})
