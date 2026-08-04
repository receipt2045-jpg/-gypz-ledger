import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import Assets from './Assets'
import { renderScreen, seedStore, TEST_YM } from '../test/renderScreen'

describe('자산 탭 — 목적지 먼저', () => {
  it('10년 목표 순자산이 순자산 요약보다 위에 있다', () => {
    seedStore({
      snapshots: [
        {
          ym: TEST_YM,
          items: [
            { id: 'a', kind: 'asset', group: 'cash', name: '주거래', amount: 10_000_000, owner: '아내' },
          ],
        },
      ],
    })
    renderScreen(<Assets />)

    const goal = screen.getByText('10년 목표 순자산')
    const summary = screen.getByText('순자산', { selector: 'p' })
    // DOM 순서: 목표 카드가 요약 카드보다 앞
    expect(
      goal.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
