import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import Card from '../components/Card'
import { PostBody, PostMeta } from '../components/PostCard'
import { fetchPost, type Post } from '../lib/posts'

/**
 * '오늘의 경제' 글 전체.
 * 앱 안(정보 탭 → 자세히 보기)과 로그인 없는 공개 화면(/news, 카톡 링크) 둘 다 이걸 쓴다.
 */
export default function PostDetail({ publicView = false }: { publicView?: boolean }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [post, setPost] = useState<Post | null | undefined>(undefined)

  useEffect(() => {
    let live = true
    fetchPost(id)
      .then((p) => live && setPost(p))
      .catch(() => live && setPost(null))
    return () => {
      live = false
    }
  }, [id])

  return (
    <div className="animate-fade-up space-y-3 lg:mx-auto lg:max-w-[720px]">
      <button
        onClick={() =>
          // 지난 글 목록에서 들어왔으면 그 목록으로, 링크로 바로 들어왔으면 첫 화면으로
          (window.history.state?.idx ?? 0) > 0
            ? navigate(-1)
            : navigate(publicView ? '/news' : '/info')
        }
        className="-ml-1 flex items-center gap-0.5 pt-2 text-[14px] font-semibold text-sub"
      >
        <ChevronLeft size={19} />
        {publicView ? '오늘의 경제' : '정보'}
      </button>

      {post === undefined && (
        <div className="flex justify-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-brand" />
        </div>
      )}

      {post === null && (
        <Card>
          <p className="text-[14px] text-sub">글을 찾을 수 없어요. 지워졌을 수 있어요.</p>
        </Card>
      )}

      {post && (
        <Card>
          <PostMeta post={post} />
          <h1 className="mt-2 text-[19px] font-bold leading-snug text-ink">{post.title}</h1>
          <div className="mt-3">
            <PostBody text={post.body} />
          </div>
        </Card>
      )}
    </div>
  )
}
