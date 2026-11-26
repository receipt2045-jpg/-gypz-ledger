import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import AssetEditor from './AssetEditor'
import { renderScreen, seedStore } from '../test/renderScreen'
import type { AssetItem } from '../types'

// 2026-11-26 결영 요청: "고칠 때 엑셀처럼" + "행 1개 정도는 여유롭게 미리"
const loan: AssetItem = {
  id: 'd1',
  kind: 'debt',
  group: 'cash',
  name: '사내대출',
  amount: 60_000_000,
  owner: '아내',
}
const stock: AssetItem = { id: 'a1', kind: 'asset', group: 'stock', name: 'ISA', amount: 5_000_000 }

const setup = (assets: AssetItem[]) => {
  seedStore({})
  const fns = {
    onChange: vi.fn(),
    onNote: vi.fn(),
    onUpdate: vi.fn(),
    onAdd: vi.fn(),
    onRemove: vi.fn(),
  }
  const r = renderScreen(
    <AssetEditor
      assets={assets}
      ownerOptions={['공동', '남편', '아내']}
      defaultOwner="공동"
      {...fns}
    />,
  )
  return { ...r, ...fns }
}

describe('자산 표 — 칸에서 바로 고치기', () => {
  it('이름은 칸을 벗어날 때 한 번만 저장하고, 비우면 원래대로', async () => {
    const { user, onUpdate } = setup([loan])
    const name = screen.getByLabelText('사내대출 이름')
    await user.clear(name)
    await user.type(name, '회사 대출{Enter}')
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith('d1', { name: '회사 대출' })
    onUpdate.mockClear()
    await user.clear(name)
    await user.tab()
    expect(onUpdate).not.toHaveBeenCalled()
    expect(name).toHaveValue('사내대출')
  })

  it('누구·구분은 칸의 목록에서 고른다', async () => {
    const { user, onUpdate } = setup([stock])
    await user.selectOptions(screen.getByLabelText('ISA 누구'), '남편')
    expect(onUpdate).toHaveBeenCalledWith('a1', { owner: '남편' })
    await user.selectOptions(screen.getByLabelText('ISA 구분'), '연금')
    expect(onUpdate).toHaveBeenCalledWith('a1', { kind: 'asset', group: 'pension' })
  })

  it('메모도 칸에서 적는다', async () => {
    const { user, onNote } = setup([stock])
    await user.type(screen.getByLabelText('ISA 메모'), '만기 2027{Enter}')
    expect(onNote).toHaveBeenCalledWith('a1', '만기 2027')
  })

  it('대출·적금이 없는 투자 줄엔 자세히 버튼이 없다', () => {
    setup([stock, loan])
    expect(screen.queryByRole('button', { name: 'ISA 자세히' })).toBeNull()
    expect(screen.getByRole('button', { name: '사내대출 자세히' })).toBeInTheDocument()
  })
})

describe('표 맨 아래 빈 줄 — 적으면 바로 새 항목', () => {
  it('자산 빈 줄에 이름·금액을 적고 Enter를 누르면 추가된다', async () => {
    const { user, onAdd } = setup([stock])
    await user.type(screen.getByLabelText('새 자산 이름'), '토스 비상금')
    await user.type(screen.getByLabelText('새 자산 금액'), '3000000{Enter}')
    expect(onAdd).toHaveBeenCalledWith({
      kind: 'asset',
      group: 'cash',
      name: '토스 비상금',
      owner: '공동',
      amount: 3_000_000,
    })
    expect(screen.getByLabelText('새 자산 이름')).toHaveValue('')
  })

  it('부채 빈 줄은 부채로, 줄을 벗어나면 추가된다', async () => {
    const { user, onAdd } = setup([])
    await user.type(screen.getByLabelText('새 부채 이름'), '전세대출')
    await user.type(screen.getByLabelText('새 부채 금액'), '80000000')
    await user.click(document.body)
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'debt', name: '전세대출', amount: 80_000_000 }),
    )
  })

  it('이름 없이 금액만 적으면 추가하지 않는다', async () => {
    const { user, onAdd } = setup([])
    await user.type(screen.getByLabelText('새 자산 금액'), '1000{Enter}')
    expect(onAdd).not.toHaveBeenCalled()
  })
})
