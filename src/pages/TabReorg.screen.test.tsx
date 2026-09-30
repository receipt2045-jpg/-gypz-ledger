import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import Monthly from './Monthly'
import Home from './Home'
import { renderScreen, seedStore } from '../test/renderScreen'
import { useLedgerStore } from '../lib/store'

describe('2026-09-30 탭 개편 — 소비 기록은 가계부 안, 목표는 홈 한 줄', () => {
  it('가계부 맨 위에서 오늘의 소비 기록으로 들어간다', () => {
    seedStore({ confessions: [] })
    renderScreen(<Monthly />)
    expect(screen.getByRole('button', { name: /오늘의 소비 기록/ })).toBeInTheDocument()
    expect(screen.getByText('오늘 쓴 돈을 말해주세요')).toBeInTheDocument()
  })

  it('목표를 세워 둔 집은 홈에서 한 줄로 본다', () => {
    seedStore({})
    const st = useLedgerStore.getState()
    useLedgerStore.setState({
      profile: {
        ...st.profile,
        goal: { amount: 100_000_000, targetYm: '2029-09', name: '내집 종잣돈', baseAssets: 0 },
      },
    })
    renderScreen(<Home />)
    expect(screen.getByText(/내집 종잣돈/)).toBeInTheDocument()
    expect(screen.getByText('2029년 9월까지')).toBeInTheDocument()
  })

  it('목표가 없으면 한 줄도 없다', () => {
    seedStore({})
    renderScreen(<Home />)
    expect(screen.queryByText(/까지$/)).not.toBeInTheDocument()
  })
})
