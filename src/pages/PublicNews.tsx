import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Card from '../components/Card'
import PostCard from '../components/PostCard'
import PostDetail from './PostDetail'
import { fetchPosts, type Post } from '../lib/posts'

/**
 * 로그인 없이 보는 '오늘의 경제' (2026-10-06).
 * 카톡 톡방 글 끝 링크(moabuli.com/news)로 들어오는 자리라 가입을 요구하지 않는다.
 * 맨 아래에서 모아불리 가계부로 이어 준다.
 */
export default function PublicNews() {
  const { id } = useParams()
  return (
    <div className="flex min-h-screen justify-center bg-bg">
      <div className="w-full max-w-app px-5 pb-16 pt-6">
        {id ? <PostDetail publicView /> : <NewsList />}
        <StartCta />
      </div>
    </div>
  )
}

function NewsList() {
  const [posts, setPosts] = useState<Post[] | null>(null)
  useEffect(() => {
    let live = true
    fetchPosts(20)
      .then((p) => live && setPosts(p))
      .catch(() => live && setPosts([]))
    return () => {
      live = false
    }
  }, [])

  return (
    <div className="animate-fade-up space-y-3">
      <header className="px-1 pb-1">
        <p className="text-[12.5px] font-bold text-brand">결영이네</p>
        <h1 className="text-[22px] font-bold text-ink">오늘의 경제</h1>
        <p className="mt-1 text-[13.5px] text-sub">톡방에 올린 글을 날짜별로 모아 뒀어요</p>
      </header>
      {posts === null && (
        <div className="flex justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-brand" />
        </div>
      )}
      {posts?.length === 0 && (
        <Card>
          <p className="text-[14px] text-sub">아직 올라온 글이 없어요.</p>
        </Card>
      )}
      {posts?.map((p) => (
        <PostCard key={p.id} post={p} basePath="/news" />
      ))}
    </div>
  )
}

function StartCta() {
  return (
    <div className="mt-6 rounded-card border-[1.5px] border-brand bg-white p-5">
      <p className="text-[12px] font-bold text-brand">모아불리 가계부</p>
      <p className="mt-1 text-[17px] font-bold leading-snug text-ink">
        뉴스 읽었으면, 우리집 돈도 한 번 볼까요?
      </p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-sub">
        부부가 각자 적어도 한 화면에 모아 보여주는 가계부예요.
      </p>
      <a
        href="#/"
        className="mt-4 flex w-full items-center justify-center rounded-btn bg-brand py-3.5 text-[15px] font-bold text-white"
      >
        모아불리 시작하기
      </a>
    </div>
  )
}
