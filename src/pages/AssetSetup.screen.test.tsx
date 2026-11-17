import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AssetSetup from './AssetSetup'
import { renderScreen, savedAssets, seedStore, TEST_YM } from '../test/renderScreen'
import type { AssetItem } from '../types'

const asset = (id: string, name: string, amount: number, owner: string): AssetItem => ({
  id,
  kind: 'asset',
  group: 'cash',
  name,
  amount,
  owner,
})

/** 자산 화면을 띄우고 '아내'를 골라 입력 화면까지 간다 */
async function openAsWife(items: AssetItem[]) {
  seedStore({
    ledgers: [{ ym: TEST_YM, items: [], closed: false, settledMembers: [] }],
    snapshots: [{ ym: TEST_YM, items }],
  })
  const { user } = renderScreen(<AssetSetup />)
  await user.click(screen.getByRole('button', { name: /아내/ }))
  return { user }
}

describe('자산 화면 — 저장', () => {
  // 예전에는 '저장하기'를 눌러야만 저장돼서, 지우고 뒤로 가면 없던 일이 됐다.
  it('삭제하고 뒤로 가도 저장된다', async () => {
    const { user } = await openAsWife([
      asset('a', '아내 주거래', 3_000_000, '아내'),
      asset('b', '공동 생활비', 1_000_000, '공동'),
    ])

    await user.click(screen.getAllByLabelText('삭제')[1]) // 공동 생활비
    await user.click(screen.getByLabelText('뒤로')) // '저장하기'가 아니라 뒤로

    expect(savedAssets().map((a) => a.name)).toEqual(['아내 주거래'])
  })

  it('저장하기로도 저장된다', async () => {
    const { user } = await openAsWife([
      asset('a', '아내 주거래', 3_000_000, '아내'),
      asset('b', '공동 생활비', 1_000_000, '공동'),
    ])

    await user.click(screen.getAllByLabelText('삭제')[0])
    await user.click(screen.getByRole('button', { name: '저장하기' }))

    expect(savedAssets().map((a) => a.name)).toEqual(['공동 생활비'])
  })

  it('아무것도 안 건드리고 나가면 그대로다', async () => {
    const { user } = await openAsWife([asset('a', '아내 주거래', 3_000_000, '아내')])

    await user.click(screen.getByLabelText('뒤로'))

    expect(savedAssets()).toHaveLength(1)
    expect(savedAssets()[0].amount).toBe(3_000_000)
  })

  it('id가 달라도(앞달에서 이어 온 달) 이름으로 찾아 표시한다', () => {
    seedStore({
      ledgers: [{ ym: TEST_YM, items: [], closed: false, settledMembers: [] }],
      snapshots: [{ ym: TEST_YM, items: [asset('a', '아내 주거래', 3_000_000, '아내')] }],
    })
    const { container } = render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/', state: { owner: '아내', focusId: 'x', focusName: '아내 주거래' } },
        ]}
      >
        <AssetSetup />
      </MemoryRouter>,
    )
    expect(container.querySelector('[data-focus]')).toHaveTextContent('아내 주거래')
  })
})

describe('자산 탭에서 눌러서 왔을 때 (2026-11-17)', () => {
  it('지난달·항목을 받아 그 달을 고치고, 누른 항목을 표시한다', () => {
    seedStore({
      ledgers: [{ ym: '2026-09', items: [], closed: false, settledMembers: [] }],
      snapshots: [{ ym: TEST_YM, items: [asset('a', '아내 주거래', 3_000_000, '아내')] }],
    })
    const { container } = render(
      <MemoryRouter
        initialEntries={[{ pathname: '/', state: { owner: '아내', focusId: 'a', ym: TEST_YM } }]}
      >
        <AssetSetup />
      </MemoryRouter>,
    )
    expect(screen.getByText(/2026년 8월 자산을 고쳐요/)).toBeInTheDocument()
    expect(screen.getByText('아내 주거래')).toBeInTheDocument()
    expect(container.querySelector('[data-focus]')).toHaveTextContent('아내 주거래')
  })
})
