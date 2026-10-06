import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import Assets from './Assets'
import { renderScreen, seedStore, TEST_YM } from '../test/renderScreen'

const seed = () =>
  seedStore({
    snapshots: [
      {
        ym: TEST_YM,
        items: [
          {
            id: 'a1',
            kind: 'asset',
            group: 'realestate',
            name: '전세보증금',
            amount: 300_000_000,
            owner: '공동',
          },
          {
            id: 'a2',
            kind: 'asset',
            group: 'cash',
            name: '남편청약',
            amount: 6_500_000,
            owner: '남편',
          },
          {
            id: 'a3',
            kind: 'asset',
            group: 'consumable',
            name: '남편차',
            amount: 14_250_000,
            owner: '남편',
          },
          {
            id: 'a4',
            kind: 'asset',
            group: 'stock',
            name: '아내코인',
            amount: 4_100_000,
            owner: '아내',
          },
          {
            id: 'd1',
            kind: 'debt',
            group: 'cash',
            name: '남편신용',
            amount: 22_000_000,
            owner: '남편',
          },
        ],
      },
    ],
  })

describe('자산 탭 — 한 화면 (2026-10-05)', () => {
  it('함께: 전체 자산 기준, 종류는 쉬운 이름으로', () => {
    seed()
    renderScreen(<Assets />)
    expect(screen.getByText(/우리집 전체 자산/)).toBeInTheDocument()
    expect(screen.getByText(/🏠 집/)).toBeInTheDocument()
    expect(screen.getByText(/🚗 기타/)).toBeInTheDocument()
    expect(screen.queryByText(/현금성|소비재|주식\/코인/)).not.toBeInTheDocument()
    expect(screen.getByText(/빼면 순자산/)).toBeInTheDocument()
    expect(screen.getByText(/모아불리 가계부 · 우리집/)).toBeInTheDocument()
  })

  it('자세히·차트·목표 카드는 없다', () => {
    seed()
    renderScreen(<Assets />)
    expect(screen.queryByRole('tab', { name: '자세히' })).not.toBeInTheDocument()
    expect(screen.queryByText('10년 목표 순자산')).not.toBeInTheDocument()
  })

  it('자산 로드맵 입구 — 설정에서 옮겨 왔다, 캡처 칸(기준 날짜 줄) 아래', () => {
    seed()
    renderScreen(<Assets />)
    const road = screen.getByRole('button', { name: /자산 로드맵/ })
    const stamp = screen.getByText(/모아불리 가계부 · 우리집 ·/)
    expect(stamp.compareDocumentPosition(road) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('남편을 고르면 남편 것만 엑셀처럼 표로', async () => {
    seed()
    const { user } = renderScreen(<Assets />)
    await user.click(screen.getByRole('button', { name: '남편' }))
    expect(screen.getByText('남편 자산표')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '비중' })).toBeInTheDocument()
    expect(screen.getByText('남편청약')).toBeInTheDocument()
    expect(screen.getByText('남편신용')).toBeInTheDocument()
    expect(screen.queryByText('아내코인')).not.toBeInTheDocument()
    // 순자산 = 650 + 1,425 − 2,200 = −125 (만원)
    expect(screen.getByText('−125')).toBeInTheDocument()
    expect(screen.getByText(/모아불리 가계부 · 남편/)).toBeInTheDocument()
  })

  it('자산이 없으면 등록 안내만', () => {
    seedStore({ snapshots: [] })
    renderScreen(<Assets />)
    expect(screen.getByText('아직 등록된 자산이 없어요')).toBeInTheDocument()
    expect(screen.queryByText(/우리집 전체 자산/)).not.toBeInTheDocument()
  })
})
