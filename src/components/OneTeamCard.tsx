import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { ONETEAM_URL } from './CalcShell'

/**
 * 부부들이 실제로 하는 고민 (결영이네 문구, 2026-10-23). [대괄호] 안은 금색.
 * 같은 고민을 세 모양으로 보여준다 (2026-10-24) — 오른쪽이 비어 보이지 않게:
 * - lines: 원문 그대로, 큰 글씨 가운데
 * - talk: 부부 대화 말풍선
 * - answer: 고민 아래 '원팀에선' 한 줄
 */
export interface OneTeamPain {
  lines: string[]
  talk: { who: '아내' | '남편'; text: string }[]
  answer: string
}

export const ONETEAM_PAINS: OneTeamPain[] = [
  {
    lines: ['남들은 [생활비 250] 쓴다는데', '우리가 많이 쓰는 건지', '아닌지를 모르겠다'],
    talk: [
      { who: '아내', text: '남들은 [생활비 250] 쓴다는데' },
      { who: '남편', text: '우리가 많이 쓰는 건가?' },
      { who: '아내', text: '모르겠어… 비교할 데가 없어' },
    ],
    answer: '우리집 고정비·생활비부터 같이 뜯어보고 줄일 곳을 찾아요',
  },
  {
    lines: ['통장 합치라는 말은', '들었는데 [세금 얘긴]', '아무도 안 해준다'],
    talk: [
      { who: '아내', text: '통장 합치면 [세금폭탄] 맞는대' },
      { who: '남편', text: '엥? 진짜? 내 친구는 괜찮다던데?' },
      { who: '아내', text: '어떡하지' },
    ],
    answer: '통장 합치기 전에, 맞벌이 부부가 챙길 절세부터 같이 짚어요',
  },
  {
    lines: ['애 낳으면 한 명은 쉬어야 하는데', '그때 [뭘로 버틸지]', '계산이 안 선다'],
    talk: [
      { who: '아내', text: '애 낳으면 한 명은 쉬어야 하잖아' },
      { who: '남편', text: '그때 [뭘로 버티지?]' },
      { who: '아내', text: '계산이 안 서…' },
    ],
    answer: '휴직 기간까지 버틸 우리집 돈 흐름을 미리 같이 짜요',
  },
  {
    lines: ['집이든 주식이든', '한 사람만 알아보고,', '[한 사람은 불안하다]'],
    talk: [
      { who: '남편', text: '집이랑 주식은 내가 알아볼게' },
      { who: '아내', text: '응… 근데 [나는 그게 더 불안해]' },
      { who: '남편', text: '왜?' },
    ],
    answer: '한 사람만 아는 돈 말고, 부부가 같이 공부해서 같이 정해요',
  },
]

export type OneTeamVariant = 'lines' | 'talk' | 'answer'
const VARIANTS: OneTeamVariant[] = ['lines', 'talk', 'answer']
/** 모양마다 높이를 고정해 둔다 — 3초마다 바뀌어도 아래 버튼이 들썩이지 않게 */
const HEIGHT: Record<OneTeamVariant, string> = {
  lines: 'h-[84px]',
  talk: 'h-[188px]',
  answer: 'h-[136px]',
}

const EVERY_MS = 3000
const plain = (line: string) => line.replace(/[[\]]/g, '')

/** '남들은 [생활비 250] 쓴다는데' → 대괄호 안만 금색 */
function Gold({ text }: { text: string }) {
  return (
    <>
      {text.split(/[[\]]/).map((part, n) =>
        n % 2 === 1 ? (
          <span key={n} className="text-[#FFD66B]">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  )
}

/**
 * 원팀프로젝트 카드 — 고민이 3초마다 바뀐다. 모양(원문·대화·답)은 들어올 때마다 랜덤.
 * "부부가 한 팀으로 재테크" 같은 설명보다, 읽는 사람이 "어 우리 얘기네" 하는 고민을 먼저 보여준다.
 * 어두운 바탕 + 인스타 스토리처럼 차오르는 막대 (2026-10-24).
 */
export default function OneTeamCard({
  onStory,
  variant: fixed,
}: {
  onStory: () => void
  /** 테스트·미리보기용 — 없으면 랜덤 */
  variant?: OneTeamVariant
}) {
  const [variant] = useState<OneTeamVariant>(
    () => fixed ?? VARIANTS[Math.floor(Math.random() * VARIANTS.length)],
  )
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % ONETEAM_PAINS.length), EVERY_MS)
    return () => clearInterval(t)
  }, [])
  const pain = ONETEAM_PAINS[i]

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
        {ONETEAM_PAINS.map((p) => (
          <li key={p.lines[0]}>{p.lines.map(plain).join(' ')}</li>
        ))}
      </ul>

      <div aria-hidden className={`mt-5 overflow-hidden ${HEIGHT[variant]}`}>
        <div key={i} className="animate-fade-up">
          {variant === 'lines' && (
            <p className="text-center text-[18px] font-extrabold leading-[28px]">
              {pain.lines.map((line) => (
                <span key={line} className="block">
                  <Gold text={line} />
                </span>
              ))}
            </p>
          )}

          {variant === 'talk' && (
            <div className="space-y-2">
              {pain.talk.map((t, n) => {
                const right = t.who === '남편'
                // 이름은 말하는 사람이 바뀔 때만
                const showWho = n === 0 || pain.talk[n - 1].who !== t.who
                return (
                  <div key={n} className={right ? 'text-right' : 'text-left'}>
                    {showWho && <p className="mx-1 mb-0.5 text-[11px] text-white/50">{t.who}</p>}
                    <span
                      className={`inline-block max-w-[85%] rounded-2xl px-3.5 py-2 text-left text-[14.5px] font-bold ${
                        right ? 'rounded-tr-md bg-brand' : 'rounded-tl-md bg-white/[0.12]'
                      }`}
                    >
                      <Gold text={t.text} />
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {variant === 'answer' && (
            <>
              <p className="text-[18px] font-extrabold leading-[28px]">
                “<Gold text={pain.lines.join(' ')} />”
              </p>
              <div className="mt-3 flex gap-2 rounded-xl bg-white/[0.08] px-3.5 py-3">
                <span className="text-[15px] leading-[21px] text-[#FFD66B]">→</span>
                <p className="text-[13.5px] leading-[21px] text-white/85">
                  <b className="font-bold text-white">원팀에선</b> {pain.answer}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {variant !== 'answer' && (
        <p
          className={`mt-5 border-t border-white/10 pt-4 text-[14px] leading-relaxed text-white/65 ${
            variant === 'lines' ? 'text-center' : ''
          }`}
        >
          이런 고민 하고 있다면,{' '}
          <b className="font-bold text-white">비슷한 고민을 하는 다른 부부들과 함께</b> 돈 공부해
          봐요.
        </p>
      )}
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
