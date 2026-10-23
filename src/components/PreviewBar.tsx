/**
 * 로그인 전 둘러보기 안내 바 — 화면 맨 위에 붙어 있다.
 * 예시라는 걸 분명히 하고, 우리 부부 것으로 쓰려면 가입하라고 한 줄로 부른다.
 */
export default function PreviewBar({
  onStart,
  onLogin,
}: {
  onStart: () => void
  onLogin: () => void
}) {
  return (
    <div className="fixed left-1/2 top-0 z-50 w-full max-w-app -translate-x-1/2 px-3 pt-2 lg:max-w-[720px]">
      <div className="flex items-center justify-between gap-2 rounded-card bg-ink py-2 pl-4 pr-2 text-white shadow-lg">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold">예시 가계부예요</p>
          <p className="truncate text-[11px] text-white/60">눌러 봐도 저장되지 않아요</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onLogin}
            className="rounded-full px-2.5 py-1.5 text-[12px] font-bold text-white/70 active:text-white"
          >
            로그인
          </button>
          <button
            onClick={onStart}
            className="rounded-full bg-brand px-3.5 py-2 text-[12.5px] font-bold text-white active:bg-brand-dark"
          >
            우리 부부 가계부 만들기
          </button>
        </div>
      </div>
    </div>
  )
}
