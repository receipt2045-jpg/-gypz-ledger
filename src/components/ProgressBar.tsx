interface ProgressBarProps {
  ratio: number // 0..1 (초과 시 100%로 클램프)
  className?: string
  trackClassName?: string
  barClassName?: string
}

export default function ProgressBar({
  ratio,
  className = '',
  trackClassName = 'bg-line',
  barClassName = 'bg-brand',
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100
  return (
    <div className={`h-2.5 w-full overflow-hidden rounded-full ${trackClassName} ${className}`}>
      <div
        className={`h-full rounded-full ${barClassName} transition-[width] duration-500 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
