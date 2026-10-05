import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AdminPosts from './AdminPosts'
import * as posts from '../lib/posts'

vi.mock('../lib/posts', async (orig) => ({
  ...(await orig<typeof import('../lib/posts')>()),
  amIAdmin: vi.fn().mockResolvedValue(true),
  fetchPosts: vi.fn().mockResolvedValue([]),
  insertPost: vi.fn(async (d: posts.PostDraft) => ({ ...d, id: 'new', createdAt: 'now' })),
}))

describe('오늘의 경제 올리기 (운영자)', () => {
  it('톡방 글을 붙여넣고 올리면 날짜·제목이 나뉘어 저장되고, 카톡 보내기가 뜬다', async () => {
    render(
      <MemoryRouter>
        <AdminPosts />
      </MemoryRouter>,
    )
    const box = await screen.findByRole('textbox')
    fireEvent.change(box, {
      target: { value: '[결영이네] 10월 2일\n미국 증시 마감 정리\n\n🔰 한 줄 정리\n조금 올랐어요' },
    })
    expect(screen.getByDisplayValue('미국 증시 마감 정리')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '앱에 올리기' }))
    expect(await screen.findByRole('button', { name: /카톡방에도 보내기/ })).toBeInTheDocument()
    const saved = vi.mocked(posts.insertPost).mock.calls[0][0]
    expect(saved).toMatchObject({ kind: 'market', title: '미국 증시 마감 정리' })
    expect(saved.postDate.endsWith('-10-02')).toBe(true)
    expect(saved.body).toBe('🔰 한 줄 정리\n조금 올랐어요')
  })
})
