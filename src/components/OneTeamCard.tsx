import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { ONETEAM_URL } from './CalcShell'

/** 부부들이 실제로 하는 고민 (결영이네 문구, 2026-10-23) — 줄바꿈 자리까지 그대로 */
export const ONETEAM_PAINS: string[][] = [
  ['남들은 생활비 250 쓴다는데', '우리가 많이 쓰는 건지', '아닌지를 모르겠다'],
  ['통장 합치라는 말은', '들었는데 세금 얘긴', '아무도 안 해준다'],
  ['애 낳으면 한 명은 쉬어야 하는데', '그때 뭘로 버틸지', '계산이 안 선다'],
  ['집이든 주식이든', '한 사람만 알아보고,', '한 사람은 불안하다'],
]

const EVERY_MS = 3000

/**
 * 원팀프로젝트 카드 — 고민 한 줄이 3초마다 바뀐다.
 * "부부가 한 팀으로 재테크" 같은 설명보다, 읽는 사람이 "어 우리 얘기네" 하는 고민을 먼저 보여준다.
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
      className="rounded-card border-[1.5px] border-brand bg-white p-5"
    >
      <p className="text-[12px] font-bold text-brand">결영이네 원팀프로젝트</p>

      {/* 화면 읽기 프로그램엔 넷 다 한 번에 — 3초마다 읽어 주면 시끄럽다 */}
      <ul className="sr-only">
        {ONETEAM_PAINS.map((lines) => (
          <li key={lines[0]}>{lines.join(' ')}</li>
        ))}
      </ul>
      {/* 세 줄 높이를 잡아 둬서 바뀔 때 아래 버튼이 들썩이지 않는다 */}
      <div aria-hidden className="mt-2 h-[78px] overflow-hidden">
        <p key={i} className="animate-fade-up text-[17px] font-extrabold leading-[26px] text-ink">
          {ONETEAM_PAINS[i].map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
      </div>
      <div aria-hidden className="mt-2 flex gap-1">
        {ONETEAM_PAINS.map((_, n) => (
          <span
            key={n}
            className={`h-1.5 rounded-full transition-all ${n === i ? 'w-4 bg-brand' : 'w-1.5 bg-line'}`}
          />
        ))}
      </div>

      <p className="mt-3 text-[14px] leading-relaxed text-sub">
        이런 고민, <b className="font-bold text-ink">우리집 숫자로 부부가 같이</b> 풀어요.
      </p>
      <a
        href={ONETEAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-btn bg-brand py-3.5 text-[15px] font-bold text-white active:bg-brand-dark"
      >
        원팀프로젝트 보러가기
        <ChevronRight size={17} />
      </a>
      <button
        onClick={onStory}
        className="mt-3 flex w-full items-center justify-center gap-0.5 text-[13px] font-bold text-sub active:text-ink"
      >
        5기 부부들은 이렇게 하고 있어요
        <ChevronRight size={15} />
      </button>
    </section>
  )
}
