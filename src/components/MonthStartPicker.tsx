const QUICK = [1, 10, 15, 20, 25]

/**
 * 우리집 한 달 시작일 고르기 (2026-10-07). 처음 시작할 때(온보딩)와 설정에서 같이 쓴다.
 * 1~28일만 — 29·30·31일은 없는 달이 있어서 받지 않는다.
 */
export default function MonthStartPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (day: number) => void
}) {
  const custom = !QUICK.includes(value)
  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="한 달 시작일">
        {QUICK.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            aria-pressed={value === d}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] font-bold ${
              value === d ? 'border-brand bg-brand text-white' : 'border-line bg-white text-sub'
            }`}
          >
            {d}일
          </button>
        ))}
        <select
          value={custom ? value : ''}
          onChange={(e) => e.target.value && onChange(Number(e.target.value))}
          aria-label="다른 날 고르기"
          className={`rounded-full border px-3 py-1.5 text-[13px] font-bold outline-none ${
            custom ? 'border-brand bg-brand text-white' : 'border-line bg-white text-sub'
          }`}
        >
          <option value="">직접</option>
          {Array.from({ length: 28 }, (_, i) => i + 1)
            .filter((d) => !QUICK.includes(d))
            .map((d) => (
              <option key={d} value={d}>
                {d}일
              </option>
            ))}
        </select>
      </div>
      <p className="mt-1.5 px-0.5 text-[12px] leading-relaxed text-cap">
        {value === 1
          ? '매달 1일부터 말일까지를 한 달로 봐요'
          : `매달 ${value}일부터 다음 달 ${value - 1}일까지를 한 달로 봐요. 월급날에 맞추면 편해요`}
      </p>
    </div>
  )
}
