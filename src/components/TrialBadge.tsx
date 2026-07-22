/**
 * 체험 중 배지 — 지금은 무료지만 정식 오픈 후 PLUS(유료)가 될 기능에 표시.
 * 미리 알려두면 나중에 잠글 때 반발이 없고, 기대감도 미리 만들어진다.
 * 사용: <TrialBadge /> — 새 유료 후보 기능에 그대로 붙이면 됨.
 */
export default function TrialBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-brand/10 px-2 py-0.5 text-[10.5px] font-bold text-brand ${className}`}
    >
      체험 중
    </span>
  )
}
