import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * 비밀번호 칸 + 눈 버튼 (2026-11-23 제보: "비밀번호 설정했는데 이메일 로그인이 안 돼").
 * 폰에선 한글 자판·첫 글자 대문자로 친 줄 모르고 정하는 일이 잦다 — 눌러서 친 글자를 볼 수 있게.
 * 자동 대문자·자동 고침은 끈다.
 */
export default function PasswordInput({
  value,
  onChange,
  onEnter,
  placeholder,
  autoComplete,
  label,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  onEnter?: () => void
  placeholder: string
  autoComplete: 'current-password' | 'new-password'
  /** 읽어 주는 이름 (없으면 placeholder) */
  label?: string
  className?: string
}) {
  const [shown, setShown] = useState(false)
  return (
    <div className={`relative ${className}`}>
      <input
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
        autoComplete={autoComplete}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="w-full rounded-btn border border-line bg-white py-3.5 pl-4 pr-12 text-[15px] text-ink outline-none focus:border-brand placeholder:text-cap"
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? '비밀번호 가리기' : '비밀번호 보기'}
        aria-pressed={shown}
        className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-cap active:bg-bg"
      >
        {shown ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}

/** 비밀번호에 한글이 섞였는지 — 한글 자판인 줄 모르고 친 경우 */
export const hasHangul = (s: string) => /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(s)
