import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import TodayCard from './TodayCard'
import { renderScreen, seedStore } from '../test/renderScreen'
import { YEAREND_SAVE_KEY } from '../lib/yearEndTax'

beforeEach(() => localStorage.clear())

describe('오늘 카드 — 연말정산 줄', () => {
  it('연봉을 아직 안 넣었으면 두 사람 이름으로 물어본다', () => {
    seedStore({})
    renderScreen(<TodayCard />)
    expect(screen.getByText(/남편 카드 쓸까, 아내 카드 쓸까\?/)).toBeInTheDocument()
    expect(screen.getByText(/연말정산 대비/)).toBeInTheDocument()
  })

  it('연봉을 넣었으면 오늘 쓸 카드를 알려준다', () => {
    localStorage.setItem(
      YEAREND_SAVE_KEY,
      JSON.stringify({ gross1: 60_000_000, gross2: 40_000_000, spent1: 0, spent2: 0 }),
    )
    seedStore({})
    renderScreen(<TodayCard />)
    expect(screen.getByText(/오늘 긁을 땐/)).toBeInTheDocument()
    expect(screen.queryByText(/카드 쓸까/)).not.toBeInTheDocument()
  })
})
