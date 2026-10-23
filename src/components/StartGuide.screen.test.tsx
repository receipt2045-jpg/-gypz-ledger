import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import StartGuide from './StartGuide'
import { renderScreen, seedStore } from '../test/renderScreen'
import { currentYm } from '../lib/format'
import type { AssetSnapshot } from '../types'

const snap = { ym: currentYm(), items: [{ id: 'a', name: '월급통장' }] } as unknown as AssetSnapshot
const ledger = {
  ym: currentYm(),
  closed: false,
  items: [{ id: 'i', group: 'income', category: '주수입', member: 1, planned: 3e6, actual: 0 }],
} as const

describe('시작 가이드 (10/23 결영이네: 자산 → 예산 → 오늘 쓴 돈 → 연말정산 → 계산기)', () => {
  beforeEach(() => localStorage.clear())

  it('처음엔 자산 넣기부터', () => {
    seedStore({})
    renderScreen(<StartGuide />)
    expect(screen.getByText('우리집 자산 넣기')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '자산 넣기' })).toBeInTheDocument()
    expect(screen.getByText('0/5')).toBeInTheDocument()
  })

  it('자산·예산·기록을 마치면 연말정산 계산기, 열어 보면 다른 계산기', async () => {
    seedStore({
      snapshots: [snap],
      ledgers: [{ ...ledger, items: [...ledger.items] }],
      confessions: [
        {
          id: 'c',
          memberNo: 1,
          kind: 'variable',
          category: '식비',
          amount: 9000,
          createdAt: new Date().toISOString(),
        },
      ],
    })
    const { user, unmount } = renderScreen(<StartGuide />)
    expect(screen.getByText('연말정산 계산기 보기')).toBeInTheDocument()
    expect(screen.getByText('3/5')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '계산해 보기' }))
    unmount()

    renderScreen(<StartGuide />)
    expect(screen.getByText('다른 돈 계산기 둘러보기')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '계산기 보기' })).toBeInTheDocument()
  })

  it('닫으면 다시 안 뜬다', async () => {
    seedStore({})
    const { user, unmount } = renderScreen(<StartGuide />)
    await user.click(screen.getByRole('button', { name: '시작 가이드 닫기' }))
    expect(screen.queryByText('우리집 가계부 시작하기')).not.toBeInTheDocument()
    unmount()
    renderScreen(<StartGuide />)
    expect(screen.queryByText('우리집 가계부 시작하기')).not.toBeInTheDocument()
  })
})
