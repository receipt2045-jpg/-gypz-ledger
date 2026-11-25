import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import Confess from './Confess'
import { renderScreen, seedStore } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'

const yesterday = (() => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('sv-SE')
})()

vi.mock('../lib/spendCapture', async (orig) => ({
  ...(await orig<typeof import('../lib/spendCapture')>()),
  readSpendCapture: vi.fn(async () => [
    {
      date: yesterday,
      merchant: '스타벅스 강남점',
      amount: 5_500,
      kind: 'variable',
      category: '카페/간식',
      confident: true,
    },
    {
      date: yesterday,
      merchant: '이마트',
      amount: 43_200,
      kind: 'variable',
      category: '',
      confident: false,
    },
  ]),
}))

describe('캡처로 적기 (2026-11-24 요청)', () => {
  it('캡처를 올리면 읽은 건이 확인 화면에 뜨고, 한 번 누르면 그 날짜로 저장된다', async () => {
    seedStore({ memberNo: 1, confessions: [] })
    const { user } = renderScreen(<Confess />)
    const file = new File(['x'], 'card.png', { type: 'image/png' })
    await user.upload(screen.getByLabelText('캡처 사진 고르기'), file)

    expect(await screen.findByText('이렇게 기록할까요?')).toBeInTheDocument()
    expect(screen.getByDisplayValue('스타벅스 강남점')).toBeInTheDocument()
    expect(screen.getByText(/캡처가 흐려서/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '2건 기록하기' }))
    const saved = useLedgerStore.getState().confessions
    expect(saved).toHaveLength(2)
    expect(saved.map((c) => new Date(c.createdAt).toLocaleDateString('sv-SE'))).toEqual([
      yesterday,
      yesterday,
    ])
    expect(saved.map((c) => c.note).sort()).toEqual(['스타벅스 강남점', '이마트'])
  })
})
