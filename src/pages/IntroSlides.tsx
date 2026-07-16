import { useState } from 'react'
import { CalendarCheck, HeartHandshake, ShieldCheck } from 'lucide-react'

// 최초 온보딩 3장 (브리프 P0 1.1 · 카피는 브리프 5장 최종본 그대로)
const SLIDES = [
  {
    Icon: CalendarCheck,
    title: '매일 안 적어도 됩니다',
    subtitle: '한 달에 한 번만 정리하면 끝나요',
  },
  {
    Icon: HeartHandshake,
    title: '둘이 함께 씁니다 🤍',
    subtitle: '각자 항목만 넣으면 자동으로 합쳐져요',
  },
  {
    Icon: ShieldCheck,
    title: '계좌는 연결하지 않습니다',
    subtitle: '입력한 내용만 안전하게 담아요',
  },
] as const

export default function IntroSlides({
  onStart,
  onSample,
}: {
  onStart: () => void
  onSample: () => void
}) {
  const [idx, setIdx] = useState(0)
  const last = idx === SLIDES.length - 1
  const { Icon, title, subtitle } = SLIDES[idx]

  return (
    <div className="flex min-h-screen justify-center bg-[#e6e9ed]">
      <div className="flex min-h-screen w-full max-w-app flex-col bg-bg px-6 shadow-[0_0_60px_rgba(0,0,0,0.06)]">
        {/* 건너뛰기 */}
        <div className="flex justify-end pt-4">
          <button onClick={onStart} className="px-2 py-1 text-[14px] font-medium text-cap">
            건너뛰기
          </button>
        </div>

        {/* 슬라이드 본문 */}
        <div key={idx} className="flex flex-1 flex-col items-center justify-center text-center animate-fade-up">
          <div className="mb-7 flex h-24 w-24 items-center justify-center rounded-[28px] bg-brand/10">
            <Icon size={44} className="text-brand" />
          </div>
          <h1 className="text-[24px] font-extrabold leading-snug text-ink">{title}</h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-sub">{subtitle}</p>
        </div>

        {/* 인디케이터 + 버튼 */}
        <div className="pb-8">
          <div className="mb-6 flex justify-center gap-2">
            {SLIDES.map((_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === idx ? 'w-5 bg-brand' : 'w-2 bg-line'
                }`}
              />
            ))}
          </div>
          {last ? (
            <div className="space-y-2">
              <button
                onClick={onStart}
                className="h-14 w-full rounded-btn bg-brand text-[16px] font-bold text-white shadow-cta active:bg-brand-dark"
              >
                바로 시작하기
              </button>
              <button
                onClick={onSample}
                className="h-12 w-full rounded-btn bg-white text-[14px] font-semibold text-sub shadow-card active:bg-line"
              >
                샘플로 둘러보기
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIdx((i) => i + 1)}
              className="h-14 w-full rounded-btn bg-brand text-[16px] font-bold text-white shadow-cta active:bg-brand-dark"
            >
              다음
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
