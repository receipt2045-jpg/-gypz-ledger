interface StepProgressProps {
  current: number // 0-based
  total: number
}

export default function StepProgress({ current, total }: StepProgressProps) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
            i <= current ? 'bg-brand' : 'bg-line'
          }`}
        />
      ))}
    </div>
  )
}
