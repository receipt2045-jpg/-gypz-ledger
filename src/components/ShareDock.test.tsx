import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ShareDock from './ShareDock'

const rpc = vi.hoisted(() =>
  vi.fn(async (name: string) =>
    name === 'share_view_counts'
      ? { data: [{ slug: 'values', viewers: 1203 }], error: null }
      : { data: null, error: null },
  ),
)
vi.mock('../lib/supabase', () => ({ supabase: { rpc } }))
const shareText = vi.hoisted(() => vi.fn(async () => 'shared' as const))
vi.mock('../lib/native', () => ({ shareText }))

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ShareDock />
    </MemoryRouter>,
  )

describe('자료 화면 맨 아래 바 (2026-11-21)', () => {
  it('몇 명이 봤는지 보여 주고, 연 것을 한 번 센다', async () => {
    at('/values')
    expect(await screen.findByText(/1,203명이 봤어요/)).toBeInTheDocument()
    expect(rpc).toHaveBeenCalledWith(
      'record_share_view',
      expect.objectContaining({ p_slug: 'values' }),
    )
  })

  it('공유하기 — # 없는 자료 주소로 공유 창을 연다', async () => {
    at('/values')
    await userEvent.click(screen.getByRole('button', { name: /공유하기/ }))
    expect(shareText).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://moabuli.com/values' }),
    )
  })

  it('자료가 아닌 화면엔 안 뜬다', () => {
    at('/monthly')
    expect(screen.queryByRole('button', { name: /공유하기/ })).not.toBeInTheDocument()
  })
})
