import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import AssetGlance from '../components/AssetGlance'
import Card from '../components/Card'
import PostCard from '../components/PostCard'
import PostDetail from './PostDetail'
import { fetchPosts, type Post } from '../lib/posts'
import { assetSeries } from '../lib/assetGlance'
import { buildSeed } from '../seed'

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

/** 자산 화면 미리보기 — 샘플 가계부 숫자로 실제 화면을 그대로 그려 줄여 보여준다(사진 대신) */
function AssetPreview() {
  const seed = useMemo(() => buildSeed(), [])
  const last = seed.snapshots[seed.snapshots.length - 1]
  const series = assetSeries(seed.snapshots, last.ym, 5)
  return (
    <div
      className="relative mt-4 h-[300px] overflow-hidden rounded-[18px] border border-line bg-bg"
      role="img"
      aria-label="모아불리 자산 화면 예시"
    >
      <div className="pointer-events-none w-[125%] origin-top-left scale-[0.8] p-4" aria-hidden>
        <p className="mb-3 px-1 text-[18px] font-bold text-ink">우리집 자산</p>
        <AssetGlance
          items={last.items}
          picked={null}
          owners={['남편', '아내', '공동']}
          ym={last.ym}
          series={series}
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
      <span className="absolute right-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-bold text-cap">
        예시 화면
      </span>
    </div>
  )
}

function StartCta() {
  return (
    <div className="mt-6 rounded-card border-[1.5px] border-brand bg-white p-5">
      <p className="text-[12px] font-bold text-brand">모아불리 가계부</p>
      <p className="mt-1 text-[17px] font-bold leading-snug text-ink">
        부부가 함께 쓰는 가계부, 모아불리
      </p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-sub">
        이번 달 우리집이 얼마 모았는지 확인해요.
      </p>
      <AssetPreview />
      <a
        href="#/"
        className="mt-4 flex w-full items-center justify-center rounded-btn bg-brand py-3.5 text-[15px] font-bold text-white"
      >
        모아불리 시작하기
      </a>
    </div>
  )
}
