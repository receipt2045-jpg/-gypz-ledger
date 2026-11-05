/** 켜고 끄는 스위치 (iOS·안드로이드 모양). 키보드는 버튼 기본 동작(Space·Enter)을 그대로 쓴다 */
export default function Toggle({
  checked,
  onChange,
  label,
  disabled,
  id,
  color = 'brand',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
  id?: string
  color?: 'brand' | 'amber'
}) {
  const on = color === 'amber' ? 'bg-amber-500' : 'bg-brand'
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-40 ${
        checked ? on : 'bg-[#D1D6DB]'
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
