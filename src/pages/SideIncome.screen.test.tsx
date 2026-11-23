import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import SideIncome from './SideIncome'
import { renderScreen, seedStore } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'
import { currentYm, formatYmKorean, shiftYm } from '../lib/format'
import { resolveLedger } from '../lib/carryover'
import { readXlsx, writeXlsx } from '../lib/xlsx'

const saveFile = vi.hoisted(() => vi.fn(async (_f: File) => 'saved' as const))
vi.mock('../lib/native', async (orig) => ({
  ...(await orig<typeof import('../lib/native')>()),
  saveFile,
}))

// 둘러보기(householdId 없음) — 예시 부수입: 이번 달 번 돈 21만, 아낀 돈 26만 3천
const month = formatYmKorean(currentYm()).split(' ')[1]

function open() {
  seedStore({
    snapshots: [
      {
        ym: currentYm(),
        items: [
          {
            id: 'c1',
            kind: 'asset',
            group: 'cash',
            name: '토스 비상금',
            amount: 1_000_000,
            owner: '공동',
          },
          { id: 'h1', kind: 'asset', group: 'realestate', name: '전세보증금', amount: 300_000_000 },
        ],
      },
    ],
  })
  return renderScreen(<SideIncome />)
}

describe('부수입 가계부 (2026-11-19)', () => {
  it('이번 달 부수입을 번 돈·아낀 돈으로 나눠 보여 준다', async () => {
    open()
    expect(await screen.findByText('473,000원')).toBeInTheDocument()
    expect(screen.getAllByText('210,000원').length).toBeGreaterThan(0)
    expect(screen.getAllByText('263,000원').length).toBeGreaterThan(0)
  })

  it('번 돈을 적으면 합계가 늘어난다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    await user.click(screen.getByRole('button', { name: /부수입 적기/ }))
    await user.click(screen.getByRole('button', { name: '중고 판매' }))
    await user.type(screen.getByLabelText(/번 금액/), '20000')
    await user.click(screen.getByRole('button', { name: '적기' }))
    expect(await screen.findByText('493,000원')).toBeInTheDocument()
  })

  it('아낀 돈은 원래 값에서 낸 돈을 뺀다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    await user.click(screen.getByRole('button', { name: /부수입 적기/ }))
    await user.click(screen.getByRole('tab', { name: '아낀 돈' }))
    await user.type(screen.getByLabelText(/얼마짜리였나요/), '60000')
    await user.type(screen.getByLabelText(/내가 낸 돈/), '10000')
    expect(screen.getByText('아낀 돈 50,000원으로 적어요')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '적기' }))
    expect(await screen.findByText('523,000원')).toBeInTheDocument()
  })

  it('금액 없이 적으면 막는다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    await user.click(screen.getByRole('button', { name: /부수입 적기/ }))
    await user.click(screen.getByRole('button', { name: '적기' }))
    expect(screen.getByText('번 금액을 넣어 주세요')).toBeInTheDocument()
  })

  it('정산 — 통장과 살림으로 보내면 자산·가계부에 더하고, 마감을 풀면 되돌린다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    await user.click(screen.getByRole('button', { name: `${month} 부수입 정산하기` }))
    // 집·자동차 같은 건 보낼 곳에 안 나온다
    expect(screen.queryByText('전세보증금')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText(/토스 비상금에 보낼 돈/), '150000')
    await user.type(screen.getByLabelText(/살림에 보태기에 보낼 돈/), '60000')
    expect(screen.getByText('안 보낸 돈 0원')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: `${month} 부수입 마감` }))

    expect(await screen.findByText(`${month} 부수입 마감 ✅`)).toBeInTheDocument()
    const st = useLedgerStore.getState()
    expect(st.snapshots.find((s) => s.ym === currentYm())?.items[0].amount).toBe(1_150_000)
    const side = resolveLedger(st.ledgers, currentYm()).items.filter(
      (it) => it.group === 'income' && it.category === '부수입',
    )
    expect(side.reduce((a, it) => a + it.actual, 0)).toBe(60_000)

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: '마감 풀기' }))
    expect(
      await screen.findByRole('button', { name: `${month} 부수입 정산하기` }),
    ).toBeInTheDocument()
    const back = useLedgerStore.getState()
    expect(back.snapshots.find((s) => s.ym === currentYm())?.items[0].amount).toBe(1_000_000)
    expect(
      resolveLedger(back.ledgers, currentYm())
        .items.filter((it) => it.category === '부수입')
        .reduce((a, it) => a + it.actual, 0),
    ).toBe(0)
  })

  it('번 돈보다 많이 보내면 마감할 수 없다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    await user.click(screen.getByRole('button', { name: `${month} 부수입 정산하기` }))
    await user.type(screen.getByLabelText(/토스 비상금에 보낼 돈/), '300000')
    expect(screen.getByText('번 돈보다 90,000원 많아요')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: `${month} 부수입 마감` })).toBeDisabled()
  })
})

describe('부수입 표로 적기 — 엑셀처럼 (2026-11-23)', () => {
  const lastRow = () => {
    const amounts = screen.getAllByLabelText(/번째 줄 금액/)
    return amounts.length
  }

  it('맨 아래 빈 줄에 종류·금액을 쓰고 Enter — 저장되고 합계가 늘어난다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    const n = lastRow()
    await user.type(screen.getByLabelText(`${n}번째 줄 종류`), '중고 판매')
    await user.type(screen.getByLabelText(`${n}번째 줄 금액`), '20000{Enter}')
    expect(await screen.findByText('493,000원')).toBeInTheDocument()
    expect(screen.getByText('저장했어요')).toBeInTheDocument()
  })

  it('종류 칸을 누르면 고르기 창 — 쓴 돈 종류를 고르면 구분도 쓴 돈, 금액 칸으로 넘어간다 (2026-11-24 폰 드롭다운)', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    const n = lastRow()
    await user.click(screen.getByLabelText(`${n}번째 줄 종류`))
    const pop = screen.getByRole('listbox', { name: '종류 고르기' })
    await user.click(within(pop).getByRole('option', { name: '광고비' }))
    expect(screen.queryByRole('listbox', { name: '종류 고르기' })).toBeNull()
    expect(screen.getByLabelText(`${n}번째 줄 종류`)).toHaveValue('광고비')
    expect(screen.getByLabelText(`${n}번째 줄 구분`)).toHaveValue('spent')
    expect(screen.getByLabelText(`${n}번째 줄 금액`)).toHaveFocus()
    await user.keyboard('30000{Enter}')
    expect(await screen.findByText('저장했어요')).toBeInTheDocument()
  })

  it('종류 없이 금액만 쓰고 넘어가면 저장하지 않고 알려 준다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    const n = lastRow()
    await user.type(screen.getByLabelText(`${n}번째 줄 금액`), '5000{Enter}')
    expect(screen.getByText('종류와 금액을 넣으면 저장돼요')).toBeInTheDocument()
    expect(screen.getByText('473,000원')).toBeInTheDocument()
  })

  it('있는 줄의 금액을 고치면 바로 반영된다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    // 예시 첫 줄(날짜순) 금액 칸
    const first = screen.getByLabelText('1번째 줄 금액') as HTMLInputElement
    const before = Number(first.value.replace(/,/g, ''))
    await user.clear(first)
    await user.type(first, String(before + 1000) + '{Enter}')
    expect(await screen.findByText('474,000원')).toBeInTheDocument()
  })

  it('엑셀에서 여러 줄을 복사해 붙여넣으면 한꺼번에 들어간다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    const ym = currentYm()
    const m = Number(ym.slice(5))
    const text = ['날짜\t종류\t금액', `${m}/1\t앱테크\t10,000`, `${m}/2\t체험단\t30000\t성수`].join(
      '\n',
    )
    await user.click(screen.getByLabelText(`${lastRow()}번째 줄 메모`))
    await user.paste(text)
    expect(
      await screen.findByText(/2줄을 넣었어요 · 1줄은 날짜나 금액이 없어 뺐어요/),
    ).toBeInTheDocument()
    expect(await screen.findByText('513,000원')).toBeInTheDocument()
  })
})

describe('부수입 쓴 돈 (2026-11-23)', () => {
  it('표에서 쓴 돈을 적으면 남은 돈(번 돈 − 쓴 돈)이 나온다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    const n = screen.getAllByLabelText(/번째 줄 금액/).length
    await user.selectOptions(screen.getByLabelText(`${n}번째 줄 구분`), 'spent')
    await user.type(screen.getByLabelText(`${n}번째 줄 종류`), '수수료')
    await user.click(screen.getByLabelText(`${n}번째 줄 매달`))
    await user.type(screen.getByLabelText(`${n}번째 줄 금액`), '3000{Enter}')
    // 210,000 − 3,000
    expect(await screen.findByText('207,000원')).toBeInTheDocument()
    expect(screen.getByText(/번 돈 − 쓴 돈 = 남은 돈/)).toBeInTheDocument()
    // 이번 달 부수입 = 번 돈 + 아낀 돈 − 쓴 돈
    expect(screen.getByText('470,000원')).toBeInTheDocument()
  })

  it('정산할 때 보낼 수 있는 돈은 쓴 돈을 뺀 만큼', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    const n = screen.getAllByLabelText(/번째 줄 금액/).length
    await user.selectOptions(screen.getByLabelText(`${n}번째 줄 구분`), 'spent')
    await user.type(screen.getByLabelText(`${n}번째 줄 종류`), '교통비')
    await user.type(screen.getByLabelText(`${n}번째 줄 금액`), '10000{Enter}')
    await screen.findByText('200,000원')
    await user.click(screen.getByRole('button', { name: `${month} 부수입 정산하기` }))
    expect(screen.getByText('안 보낸 돈 200,000원')).toBeInTheDocument()
  })
})

describe('종류 하나만 보기 — 그 종류 합계 (2026-11-23)', () => {
  it('종류를 고르면 그 종류 이번 달 합계·건수·올해 합계, 표에도 그 기록만', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    // 예시: 이번 달 앱테크 32,000 (1건), 지난달 41,000
    await user.click(screen.getByRole('button', { name: '앱테크', pressed: false }))
    expect(screen.getByText(/1건 · 올해 73,000원/)).toBeInTheDocument()
    expect(screen.getAllByText('32,000원').length).toBeGreaterThan(0)
    // 표엔 앱테크 한 줄 + 새 줄(앱테크로 미리 채움)
    expect(screen.getAllByLabelText(/번째 줄 금액/)).toHaveLength(2)
    expect(screen.getByLabelText('2번째 줄 종류')).toHaveValue('앱테크')
    await user.click(screen.getByRole('button', { name: '전체 보기' }))
    expect(screen.getAllByLabelText(/번째 줄 금액/).length).toBeGreaterThan(2)
  })

  it('고른 종류 이름 바꾸기 — 모든 달의 같은 종류가 한꺼번에 바뀐다 (2026-11-24)', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    await user.click(screen.getByRole('button', { name: '앱테크', pressed: false }))
    await user.click(screen.getByRole('button', { name: /이름 바꾸기/ }))
    await user.type(screen.getByLabelText('바꿀 종류 이름'), '캐시워크')
    // 이번 달 1건 + 지난달 1건
    await user.click(screen.getByRole('button', { name: '2건 모두 바꾸기' }))
    expect(
      await screen.findByRole('button', { name: '캐시워크', pressed: true }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '앱테크', pressed: false })).toBeNull()
    expect(screen.getByText(/1건 · 올해 73,000원/)).toBeInTheDocument()
  })

  it('종류별 칸의 줄을 눌러도 그 종류만 본다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    await user.click(screen.getByRole('button', { name: '체험단만 보기' }))
    expect(screen.getByText(/1건 · 올해 140,000원/)).toBeInTheDocument()
  })
})

describe('부수입 엑셀로 받기·올리기 (2026-11-23)', () => {
  it('이번 달 엑셀 — 파일을 만들어 받는다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    await user.click(screen.getByRole('button', { name: new RegExp(`${month} 엑셀`) }))
    expect(saveFile).toHaveBeenCalled()
    const file = saveFile.mock.calls.at(-1)![0] as File
    expect(file.name).toBe(`모아불리_부수입_${currentYm()}.xlsx`)
    // 머리줄 + 이번 달 예시 7줄
    const rows = readXlsx(new Uint8Array(await file.arrayBuffer()))
    expect(rows[0]).toEqual(['날짜', '구분', '종류', '금액', '누가', '매달', '메모'])
    expect(rows).toHaveLength(8)
    expect(await screen.findByText(/7줄\)을 받았어요/)).toBeInTheDocument()
  })

  it('엑셀 올리기 — 새 줄만 넣고, 이미 있는 줄은 뺀다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { user } = open()
    await screen.findByText('473,000원')
    const ym = currentYm()
    const data = writeXlsx([
      ['날짜', '구분', '종류', '금액', '누가', '매달', '메모'],
      [`${ym}-01`, '번 돈', '중고 판매', 15000, '남편', '', '책'],
      [`${ym}-02`, '쓴 돈', '구독·프로그램', 9900, '아내', '매달', ''],
    ])
    const file = new File([data.slice().buffer as ArrayBuffer], '부수입.xlsx')
    await user.upload(screen.getByLabelText('엑셀 파일 고르기'), file)
    expect(await screen.findByText(/2줄을 넣었어요/)).toBeInTheDocument()
    // 473,000 + 15,000 − 9,900
    expect(await screen.findByText('478,100원')).toBeInTheDocument()
    // 같은 파일을 또 올리면 모두 이미 있다
    await user.upload(screen.getByLabelText('엑셀 파일 고르기'), file)
    expect(await screen.findByText('2줄 모두 이미 적혀 있어요')).toBeInTheDocument()
  })
})

describe('부수입 달력·번 돈 꺾은선 (2026-11-24)', () => {
  it('달력으로 보면 날짜를 눌러 그날 기록만 본다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    await user.click(screen.getByRole('tab', { name: '달력' }))
    const now = new Date()
    const d = Math.min(9, Math.max(1, Math.min(now.getDate(), 28)))
    const cell = screen.getByRole('button', {
      name: new RegExp(`^${now.getMonth() + 1}월 ${d}일 `),
    })
    expect(cell).toHaveAccessibleName(/들어온 돈/)
    await user.click(cell)
    expect(screen.getByText(/캐시워크 출금/)).toBeInTheDocument()
    localStorage.removeItem('moabuli.side.view')
  })

  it('최근 6개월 번 돈을 꺾은선으로, 달을 누르면 그 달로 간다', async () => {
    const { user } = open()
    await screen.findByText('473,000원')
    expect(screen.getByText(`${currentYm().slice(0, 4)}년 번 돈`)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /최근 6개월 부수입/ })).toHaveAccessibleName(
      /번 돈 210,000원$/,
    )
    const prevLabel = `${Number(shiftYm(currentYm(), -1).slice(5, 7))}월`
    await user.click(screen.getByRole('button', { name: `${prevLabel} 부수입 보기` }))
    expect(screen.getByRole('button', { name: `${prevLabel} 부수입 보기` })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
