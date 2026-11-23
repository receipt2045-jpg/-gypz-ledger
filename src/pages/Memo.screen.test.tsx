import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import Memo from './Memo'
import { renderScreen, seedStore } from '../test/renderScreen'
import { sortMemos, type Memo as MemoRow } from '../lib/memoDb'

describe('우리집 메모 (2026-11-24, 11-13 의견)', () => {
  it('메모를 남기고, 고치고, 맨 위에 고정하고, 지운다', async () => {
    seedStore({})
    const { user } = renderScreen(<Memo />)
    // 둘러보기 예시 메모
    expect(await screen.findByText(/통신비 알뜰폰으로/)).toBeInTheDocument()

    await user.type(screen.getByLabelText('새 메모'), '1월에 자동차세 연납 신청')
    await user.click(screen.getByRole('button', { name: '메모 남기기' }))
    expect(await screen.findByText('1월에 자동차세 연납 신청')).toBeInTheDocument()

    await user.click(screen.getByText('1월에 자동차세 연납 신청'))
    const box = screen.getByLabelText('메모 고치기 칸')
    await user.clear(box)
    await user.type(box, '1월 16일까지 자동차세 연납 신청')
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(await screen.findByText('1월 16일까지 자동차세 연납 신청')).toBeInTheDocument()

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const before = screen.getAllByRole('button', { name: '메모 지우기' }).length
    await user.click(screen.getAllByRole('button', { name: '메모 지우기' })[0])
    await vi.waitFor(() =>
      expect(screen.getAllByRole('button', { name: '메모 지우기' })).toHaveLength(before - 1),
    )
  })

  it('고정한 메모가 먼저, 그다음 최근에 고친 순', () => {
    const m = (id: string, pinned: boolean, updatedAt: string): MemoRow => ({
      id,
      memberNo: 1,
      body: id,
      pinned,
      createdAt: updatedAt,
      updatedAt,
    })
    const sorted = sortMemos([
      m('a', false, '2026-11-20'),
      m('b', true, '2026-11-01'),
      m('c', false, '2026-11-23'),
    ])
    expect(sorted.map((x) => x.id)).toEqual(['b', 'c', 'a'])
  })
})
