import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { ONETEAM_URL } from './CalcShell'

/**
 * 부부들이 실제로 하는 고민 (결영이네 문구, 2026-10-23) — 줄바꿈 자리까지 그대로.
 * [대괄호] 안은 금색으로 띄운다 (2026-10-24 "있어보이게").
 */
export const ONETEAM_PAINS: string[][] = [
  ['남들은 [생활비 250] 쓴다는데', '우리가 많이 쓰는 건지', '아닌지를 모르겠다'],
  ['통장 합치라는 말은', '들었는데 [세금 얘긴]', '아무도 안 해준다'],
  ['애 낳으면 한 명은 쉬어야 하는데', '그때 [뭘로 버틸지]', '계산이 안 선다'],
  ['집이든 주식이든', '한 사람만 알아보고,', '[한 사람은 불안하다]'],
]

const EVERY_MS = 3000
const plain = (line: string) => line.replace(/[[\]]/g, '')

/** '남들은 [생활비 250] 쓴다는데' → 대괄호 안만 금색 */
function Line({ text }: { text: string }) {
  return (
    <span className="block">
      {text.split(/[[\]]/).map((part, n) =>
        n % 2 === 1 ? (
          <span key={n} className="text-[#FFD66B]">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </span>
  )
}

/**
 * 원팀프로젝트 카드 — 고민 한 줄이 3초마다 바뀐다.
 * "부부가 한 팀으로 재테크" 같은 설명보다, 읽는 사람이 "어 우리 얘기네" 하는 고민을 먼저 보여준다.
 * 어두운 바탕 + 인스타 스토리처럼 차오르는 막대 (2026-10-24).
 */
export default function OneTeamCard({ onStory }: { onStory: () => void }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % ONETEAM_PAINS.length), EVERY_MS)
    return () => clearInterval(t)
  }, [])

  return (
    <section
      aria-label="원팀프로젝트"
      className="relative overflow-hidden rounded-card bg-ink px-5 pb-5 pt-4 text-white shadow-card"
    >
      {/* 큰 따옴표 — 이 문장들이 '누군가의 말'이라는 느낌 */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-1 -top-6 font-serif text-[140px] leading-none text-white/[0.06]"
      >
        ”
      </span>

      {/* 스토리 막대 — 지난 건 꽉, 지금 건 3초 동안 차오른다 */}
      <div aria-hidden className="flex gap-1">
        {ONETEAM_PAINS.map((_, n) => (
          <span key={n} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/20">
            {n < i && <span className="block h-full w-full bg-white/80" />}
            {n === i && <span key={i} className="block h-full animate-story-fill bg-white" />}
          </span>
        ))}
      </div>

      {/* 화면 읽기 프로그램엔 넷 다 한 번에 — 3초마다 읽어 주면 시끄럽다 */}
      <ul className="sr-only">
        {ONETEAM_PAINS.map((lines) => (
          <li key={lines[0]}>{lines.map(plain).join(' ')}</li>
        ))}
      </ul>
      {/* 세 줄 높이를 잡아 둬서 바뀔 때 아래가 들썩이지 않는다 */}
      <div aria-hidden className="mt-5 h-[84px] overflow-hidden">
        <p key={i} className="animate-fade-up text-[18px] font-extrabold leading-[28px]">
          {ONETEAM_PAINS[i].map((line) => (
            <Line key={line} text={line} />
          ))}
        </p>
      </div>

      <p className="mt-5 border-t border-white/10 pt-4 text-[14px] leading-relaxed text-white/65">
        이런 고민 하고 있다면,{' '}
        <b className="font-bold text-white">비슷한 고민을 하는 다른 부부들과 함께</b> 돈 공부해
        봐요.
      </p>
      <a
        href={ONETEAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex w-full items-center justify-center gap-1 rounded-btn bg-white py-3.5 text-[15px] font-bold text-ink active:bg-white/90"
      >
        원팀프로젝트 보러가기
        <ChevronRight size={17} />
      </a>
      <button
        onClick={onStory}
        className="mt-3 flex w-full items-center justify-center gap-0.5 text-[13px] font-bold text-white/60 active:text-white"
      >
        5기 부부들은 이렇게 하고 있어요
        <ChevronRight size={15} />
      </button>
    </section>
  )
}
