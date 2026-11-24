import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import AssetEditor from './AssetEditor'
import { renderScreen, seedStore } from '../test/renderScreen'
import type { AssetItem } from '../types'

const cash: AssetItem = {
  id: 'a1',
  kind: 'asset',
  group: 'cash',
  name: '청년도약계좌',
  amount: 1_000_000,
}

const setup = (assets: AssetItem[]) => {
  seedStore({})
  const onUpdate = vi.fn()
  const r = renderScreen(
    <AssetEditor
      assets={assets}
      ownerOptions={['공동']}
      defaultOwner="공동"
      onChange={vi.fn()}
      onNote={vi.fn()}
      onUpdate={onUpdate}
      onAdd={vi.fn()}
      onRemove={vi.fn()}
    />,
  )
  return { ...r, onUpdate }
}

describe('적금 자동 저축 입력 (2026-11-24 의견)', () => {
  it('예적금 줄에서 매달 넣는 돈·넣는 날·만기를 적어 저장한다', async () => {
    const { user, onUpdate } = setup([cash])
    await user.click(screen.getByRole('button', { name: /매달 자동으로 쌓기/ }))
    await user.type(screen.getByLabelText('매달 넣는 돈'), '300000')
    await user.selectOptions(screen.getByLabelText('넣는 날'), '10')
    expect(screen.getByText(/넣는 날마다/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(onUpdate).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({
        saving: expect.objectContaining({ monthly: 300_000, day: 10 }),
      }),
    )
  })

  it('켜 둔 적금은 한 줄 요약이 보이고, 끌 수 있다', async () => {
    const { user, onUpdate } = setup([
      { ...cash, saving: { monthly: 500_000, day: 25, asOf: '2026-11-01' } },
    ])
    expect(screen.getByText(/자동 저축/)).toBeInTheDocument()
    await user.click(screen.getByText(/자동 저축/))
    await user.click(screen.getByRole('button', { name: '끄기' }))
    expect(onUpdate).toHaveBeenCalledWith('a1', { saving: undefined })
  })

  it('투자·집·부채 줄엔 안 나온다', () => {
    setup([{ ...cash, group: 'stock' }])
    expect(screen.queryByRole('button', { name: /매달 자동으로 쌓기/ })).toBeNull()
  })
})
