import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import Home from './Home'
import { renderScreen, seedStore, TEST_YM } from '../test/renderScreen'
import { shiftYm } from '../lib/format'
import type { AssetItem } from '../types'

const house = (amount: number): AssetItem => ({
  id: 'h',
  kind: 'asset',
  group: 'realestate',
  name: '아파트',
  amount,
  owner: '공동',
})

describe('홈 — 전체 자산 흐름을 바로 (2026-11-17 의견)', () => {
  it('점(달)을 누르면 바로 지난달과 견준 표가 뜬다', async () => {
    seedStore({
      snapshots: [
        { ym: TEST_YM, items: [house(300_000_000)] },
        { ym: shiftYm(TEST_YM, 1), items: [house(320_000_000)] },
      ],
    })
    const { user } = renderScreen(<Home />)
    expect(screen.getByText('전체 자산 흐름')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '2026년 9월 자산 보기' }))
    const row = screen.getByRole('row', { name: /^집/ })
    expect(row).toHaveTextContent('32,000')
    expect(row).toHaveTextContent('+2,000')
  })
})
