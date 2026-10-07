import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import Assets from './Assets'
import AssetSetup from './AssetSetup'
import { renderScreen, seedStore, TEST_YM } from '../test/renderScreen'
import type { AssetItem } from '../types'

const house: AssetItem = {
  id: 'h',
  kind: 'asset',
  group: 'realestate',
  name: '우리집',
  amount: 500_000_000,
  owner: '공동',
}
const mortgage: AssetItem = {
  id: 'm',
  kind: 'debt',
  group: 'realestate',
  name: '주택담보대출',
  amount: 240_000_000,
  owner: '공동',
}

describe('대출 상환 (2026-10-07 제보)', () => {
  it('자산 탭 부채 줄 아래에 매달 갚는 돈', () => {
    seedStore({
      snapshots: [
        {
          ym: TEST_YM,
          items: [
            house,
            {
              ...mortgage,
              loan: { rate: 4.2, months: 336, payDay: 25, method: 'annuity', asOf: '2099-01-01' },
            },
          ],
        },
      ],
    })
    renderScreen(<Assets />)
    expect(screen.getByText('대출 갚는 돈 매달')).toBeInTheDocument()
    expect(screen.getByText(/원금 .*씩 갚는 날마다 자동으로 줄어요/)).toBeInTheDocument()
  })

  it('자산 등록에서 부채에 대출 정보를 넣으면 매달 갚는 돈이 보이고 저장된다', async () => {
    seedStore({ snapshots: [{ ym: TEST_YM, items: [house, mortgage] }] })
    const { user } = renderScreen(<AssetSetup />)
    await user.click(screen.getAllByRole('button', { name: /남편|공동|아내/ })[0])
    const open = await screen.findByRole('button', { name: /대출 정보 넣기/ })
    await user.click(open)
    await user.type(screen.getByPlaceholderText('예) 4.2'), '4.2')
    await user.type(screen.getByPlaceholderText('예) 30'), '28')
    expect(screen.getByText(/갚는 날마다 남은 대출이 원금만큼 줄어요/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '저장' }))
    expect(screen.getByText(/갚아요/)).toBeInTheDocument()
  })

  it('부채를 추가하는 칸에서 바로 대출 정보까지 넣는다', async () => {
    seedStore({ snapshots: [{ ym: TEST_YM, items: [house] }] })
    const { user } = renderScreen(<AssetSetup />)
    await user.click(screen.getAllByRole('button', { name: /남편|공동|아내/ })[0])
    await user.click(await screen.findByRole('button', { name: /자산·부채 추가/ }))
    await user.click(screen.getByRole('button', { name: '부채' }))
    await user.type(screen.getByPlaceholderText(/이름/), '보금자리')
    await user.type(screen.getByPlaceholderText('남은 대출금'), '240000000')
    await user.click(screen.getByRole('button', { name: /대출 정보 넣기/ }))
    await user.type(screen.getByPlaceholderText('예) 4.2'), '4.2')
    await user.type(screen.getByPlaceholderText('예) 30'), '28')
    expect(screen.getByText(/다 갚는 달/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '추가' }))
    expect(screen.getByText('보금자리')).toBeInTheDocument()
    expect(screen.getByText(/갚아요/)).toBeInTheDocument()
  })
})
