import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import ShareArticle, {
  ShareHero,
  ShareSection,
} from "../components/ShareArticle";
import { supabase } from "../lib/supabase";
import { rememberLogin } from "../lib/preview";
import { computeMatch, type ValuesMatch } from "../lib/valuesMatch";
import {
  deleteMyValues,
  fetchValuesRows,
  loadValuesCloud,
  saveMyValues,
  type ValuesCloud,
} from "../lib/valuesDb";

/**
 * 부부 재테크 가치관 체크리스트 50 (2026-11-19) — 로그인 없이 열리는 공개 페이지.
 * 인스타툰 「결혼자금 3천만원, 적은 걸까?」 댓글로 받은 사람이 들어온다.
 * 각자 자기 폰에서 자기 칸(아내/남편)만 ○✕ → 두 답을 합쳐 궁합 카드(같은 답 비율)와 다른 것 목록을 보여 준다. 정답 없음.
 * 합치는 길 두 가지 (11-19 결영 "내 폰에서는 나만, 배우자는 배우자 것 / 로그인하면 합쳐지게"):
 *  - 로그인한 부부: household_values 표(supabase/household-values.sql)에 한 사람 한 행 → 저절로 합침.
 *  - 로그인 안 함: '배우자에게 보내기' 링크(#/values?w=.. 또는 ?h=..)에 내 답만 실어 보냄 — 서버에 안 보냄.
 */
type Mark = 0 | 1 | 2; // 0 빈칸 · 1 ○ · 2 ✕

const GROUPS: { title: string; emoji: string; items: string[] }[] = [
  {
    title: "소비",
    emoji: "🛍️",
    items: [
      "명품 하나쯤은 있어야 한다고 생각한다",
      "사고 싶은 거 하나 정도는 사도 됨",
      "여행 가면 숙소는 좋은 데서 자고 싶다",
      "10만 원 넘는 물건은 서로 물어보고 산다",
      "기념일 선물은 꼭 챙겨야 한다",
    ],
  },
  {
    title: "저축",
    emoji: "🐷",
    items: [
      "돈이 생기면 무조건 저축",
      "월급의 절반은 저축해야 한다",
      "비상금은 따로 있어야 마음이 편하다",
      "모을 금액과 날짜를 정해 두고 모아야 한다",
      "저축이 소비보다 중요하다",
    ],
  },
  {
    title: "통장·돈 관리",
    emoji: "🏦",
    items: [
      "통장은 합쳐야 돈이 모인다",
      "서로 월급을 다 알아야 한다",
      "돈 관리는 한 사람이 맡는 게 낫다",
      "월급 관리는 각자 따로 하고 싶다",
      "각자 비자금이 있어도 괜찮다",
    ],
  },
  {
    title: "용돈·가계부",
    emoji: "📒",
    items: [
      "용돈은 정해진 금액만 쓴다",
      "용돈은 어디 썼는지 안 알려도 된다",
      "가계부는 꼭 써야 한다",
      "한 달에 한 번은 같이 돈 이야기를 해야 한다",
      "카드 결제 알림을 서로 공유해도 괜찮다",
    ],
  },
  {
    title: "부수입",
    emoji: "💼",
    items: [
      "월급 말고 부수입이 꼭 있어야 한다",
      "퇴근 후·주말에 부업해도 괜찮다",
      "부수입은 쓰지 말고 모으거나 투자한다",
      "배우자가 SNS로 돈을 버는 건 찬성이다",
      "회사를 그만두고 사업해도 된다",
    ],
  },
  {
    title: "투자",
    emoji: "📈",
    items: [
      "주식은 도박이다",
      "손해 봐도 투자는 해야 한다",
      "투자는 꼭 서로 상의하고 한다",
      "코인도 투자라고 생각한다",
      "원금이 보장 안 되면 하지 않는다",
    ],
  },
  {
    title: "대출·집",
    emoji: "🏠",
    items: [
      "대출 끼고라도 집은 빨리 사는 게 낫다",
      "빚은 무조건 빨리 갚아야 한다",
      "청약 당첨될 때까지 기다리는 게 낫다",
      "집은 사는 곳이지 투자가 아니다",
      "대출을 받아서 투자해도 된다",
    ],
  },
  {
    title: "양가·가족",
    emoji: "👨‍👩‍👧",
    items: [
      "양가 부모님 용돈은 똑같이 드려야 한다",
      "부모님을 모시고 살 수 있다",
      "형제자매에게 돈을 빌려줄 수 있다",
      "명절 비용은 양가에 똑같이 쓴다",
      "부모님께 돈 도움을 받아도 괜찮다",
    ],
  },
  {
    title: "아이",
    emoji: "👶",
    items: [
      "아이 교육비는 아끼지 않는다",
      "아이 낳기 전에 목돈을 모아 둬야 한다",
      "아이가 커도 맞벌이는 계속한다",
      "아이 이름으로 미리 모으거나 투자해 둔다",
      "육아휴직으로 수입이 줄어도 괜찮다",
    ],
  },
  {
    title: "노후·기타",
    emoji: "🌱",
    items: [
      "보험은 많을수록 안심이다",
      "노후 준비는 지금부터 해야 한다",
      "기부는 꾸준히 하고 싶다",
      "일찍 은퇴하고 싶다",
      "차는 새 차로 사야 한다",
    ],
  },
];
const ITEMS = GROUPS.flatMap((g) => g.items);
const N = ITEMS.length; // 50
const KEY = "moabuli.values.v1";

function decode(s: string | null): Mark[] | null {
  if (!s || !/^[012]+$/.test(s)) return null;
  const a = s.slice(0, N).split("").map((c) => Number(c) as Mark);
  while (a.length < N) a.push(0);
  return a;
}
const encode = (a: Mark[]) => a.join("");
const empty = (): Mark[] => Array(N).fill(0) as Mark[];

type Who = "w" | "h";
const NAME: Record<Who, string> = { w: "아내", h: "남편" };
const other = (x: Who): Who => (x === "w" ? "h" : "w");
const done = (a: Mark[]) => a.filter(Boolean).length;
const RETURN_KEY = "moabuli.returnTo"; // App onSignedIn 이 읽고 이 페이지로 돌려보냄

export default function Values() {
  const { search } = useLocation();
  const [ans, setAns] = useState<Record<Who, Mark[]>>({ w: empty(), h: empty() });
  const [me, setMe] = useState<Who | null>(null);
  const [arrived, setArrived] = useState<Who | null>(null); // 링크로 배우자 답이 막 들어옴
  const [peek, setPeek] = useState(false); // 내 답 다 안 했어도 결과 먼저 보기
  const [copied, setCopied] = useState(false);
  const [ready, setReady] = useState(false);
  const [cloud, setCloud] = useState<ValuesCloud | null>(null); // 로그인한 부부 = 서버에서 합침
  const [authed, setAuthed] = useState(false);

  // 처음: 이 기기에 저장된 답 위에 링크에 실린 답을 얹는다.
  // 링크에 한 사람 답만 있으면 = 배우자가 보낸 것 → 나는 반대쪽.
  useEffect(() => {
    let saved: { w?: string; h?: string; me?: string } = {};
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch {
      saved = {};
    }
    const q = new URLSearchParams(search);
    const lw = decode(q.get("w"));
    const lh = decode(q.get("h"));
    let mine: Who | null = saved.me === "w" || saved.me === "h" ? saved.me : null;
    const next = {
      w: decode(saved.w ?? null) ?? empty(),
      h: decode(saved.h ?? null) ?? empty(),
    };
    let got: Who | null = null;
    if (lw && !lh) got = "w";
    if (lh && !lw) got = "h";
    if (got) {
      if (!mine || mine === got) mine = other(got); // 보낸 사람 칸은 내 칸이 아님
      next[got] = got === "w" ? lw! : lh!;
    } else if (lw && lh && mine) {
      next[other(mine)] = mine === "w" ? lh : lw; // 결과 링크: 내 답은 내 기기 것 유지
      if (!done(next[mine])) next[mine] = mine === "w" ? lw : lh;
    } else if (lw && lh) {
      next.w = lw;
      next.h = lh;
    }
    setAns(next);
    setMe(mine);
    setArrived(got);
    setReady(true);
  }, [search]);

  // 로그인한 부부: 서버에 있는 내 답·배우자 답을 얹는다
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => alive && setAuthed(!!data.session));
    void loadValuesCloud()
      .then((c) => {
        if (!alive || !c) return;
        const mineRow = c.rows.find((r) => r.userId === c.userId);
        const theirs = c.rows.find((r) => r.userId !== c.userId);
        setMe((cur) => {
          const role: Who | null = mineRow?.role ?? (theirs ? other(theirs.role) : cur);
          setAns((prev) => {
            const next = { ...prev };
            if (role && mineRow) {
              const a = decode(mineRow.answers);
              if (a && done(a)) next[role] = a;
            }
            if (theirs) next[role ? other(role) : theirs.role] = decode(theirs.answers) ?? empty();
            return next;
          });
          return role;
        });
        setCloud(c);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [ready]);

  // 로그인한 부부: 내 답을 서버에 (잠깐 모았다가)
  const myAnswers = me ? encode(ans[me]) : "";
  useEffect(() => {
    if (!cloud || !me) return;
    if (!/[12]/.test(myAnswers) && !cloud.rows.some((r) => r.userId === cloud.userId)) return;
    const t = setTimeout(() => void saveMyValues(cloud.householdId, cloud.userId, me, myAnswers), 700);
    return () => clearTimeout(t);
  }, [cloud, me, myAnswers]);

  // 로그인한 부부: 배우자 답을 주기적으로 / 화면에 돌아올 때 다시 가져온다
  useEffect(() => {
    if (!cloud || !me) return;
    const pull = () =>
      void fetchValuesRows(cloud.householdId).then((rows) => {
        const theirs = rows?.find((r) => r.userId !== cloud.userId);
        const a = theirs && decode(theirs.answers);
        if (a) setAns((prev) => (encode(prev[other(me)]) === encode(a) ? prev : { ...prev, [other(me)]: a }));
      });
    const iv = setInterval(pull, 15000);
    window.addEventListener("focus", pull);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", pull);
    };
  }, [cloud, me]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify({ w: encode(ans.w), h: encode(ans.h), me }));
    } catch {
      /* 저장 못 해도 화면은 그대로 */
    }
  }, [ans, me, ready]);

  const pick = (i: number, v: 1 | 2) => {
    if (!me) return;
    setAns((prev) => {
      const a = [...prev[me]] as Mark[];
      a[i] = a[i] === v ? 0 : v; // 같은 걸 다시 누르면 지움
      return { ...prev, [me]: a };
    });
  };

  const wife = ans.w;
  const husband = ans.h;
  const match = useMemo(() => computeMatch(GROUPS, wife, husband), [wife, husband]);
  const diffList = useMemo(
    () => ITEMS.map((_, i) => i).filter((i) => wife[i] && husband[i] && wife[i] !== husband[i]),
    [wife, husband],
  );

  const myDone = me ? done(ans[me]) : 0;
  const partner = me ? other(me) : null;
  const partnerDone = partner ? done(ans[partner]) : 0;
  const showResult = partnerDone > 0 && (myDone === N || peek);

  // 로그인한 부부는 페이지 주소만, 아니면 링크에 답을 실어 보낸다
  const link =
    !me || cloud
      ? "https://moabuli.com/#/values"
      : partnerDone
        ? `https://moabuli.com/#/values?w=${encode(wife)}&h=${encode(husband)}`
        : `https://moabuli.com/#/values?${me}=${encode(ans[me])}`;
  const share = () => {
    const text = cloud
      ? partnerDone
        ? "우리 재테크 궁합 결과 나왔어! 모아불리에서 같이 보자 👉 "
        : "재테크 가치관 체크리스트 내 답은 해 놨어. 모아불리 로그인해서 너도 해 봐! 👉 "
      : partnerDone
        ? "우리 재테크 가치관 결과 나왔어! 생각 다른 것부터 얘기해 보자 👉 "
        : "재테크 가치관 체크리스트 내 답은 해 놨어. 너도 해 봐! 👉 ";
    if (navigator.share) {
      navigator.share({ title: "부부 재테크 가치관 체크리스트 50", text, url: link }).catch(() => undefined);
      return;
    }
    navigator.clipboard
      ?.writeText(text + link)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };
  const reset = () => {
    if (!window.confirm(cloud ? "내 답을 모두 지울까요? (배우자 답은 그대로예요)" : "이 폰에 있는 답(내 답·배우자 답)을 모두 지울까요?"))
      return;
    if (cloud && me) {
      setAns((prev) => ({ ...prev, [me]: empty() }));
      void deleteMyValues(cloud.householdId, cloud.userId);
      setCloud({ ...cloud, rows: cloud.rows.filter((r) => r.userId !== cloud.userId) });
      setPeek(false);
      return;
    }
    setAns({ w: empty(), h: empty() });
    setMe(null);
    setArrived(null);
    setPeek(false);
  };
  const goLogin = () => {
    try {
      localStorage.setItem(RETURN_KEY, "/values");
    } catch {
      /* 못 남겨도 로그인은 된다 */
    }
    rememberLogin(true);
    window.location.hash = "#/";
  };

  let idx = 0;
  return (
    <ShareArticle
      kind="guide"
      toc={[
        { no: 1, title: "이렇게 해요" },
        { no: 2, title: "체크리스트 50" },
        { no: 3, title: "우리 결과" },
      ]}
      hero={
        <ShareHero
          kicker="결영이네 부부 체크리스트"
          title={
            <>
              재테크 가치관
              <br />
              체크리스트 50
            </>
          }
          lead={
            <>
              얼마 모았는지보다 <b className="font-bold text-[#FFD66B]">생각이 같은지</b>
              가 먼저예요.
              <br />
              각자 폰으로 ○✕ 하면 두 답을 합쳐서 우리 부부 궁합을 보여 드려요.
            </>
          }
        />
      }
      sources={
        <>
          <p className="font-semibold text-sub">알려 드려요</p>
          <p className="mt-1.5">
            결영이네 「결혼 가치관 질문 50」(2023) 중 경제 생활·부모님·아이 질문을 ○✕ 로 바꾸고, 소비·저축·통장·부수입·투자·대출 질문을 더했어요.
          </p>
          <p className="mt-1.5">
            정답이 있는 체크리스트가 아니에요. 로그인 안 하면 답은 이 폰에만 저장되고, 보내기를
            누르면 링크에 답이 담겨 가요. 모아불리에 로그인하면 우리 집 계정에 저장돼 배우자와만
            합쳐져요.
          </p>
        </>
      }
    >
      <ShareSection no={1} title="이렇게 해요">
        <ol className="space-y-2.5 text-[15px] leading-relaxed text-sub">
          <li>
            <b className="text-ink">① 내 폰에서 내 답만</b> — 아내인지 남편인지 고르고 50개에 ○✕.
            배우자 답은 안 보여요.
          </li>
          <li>
            <b className="text-ink">② 두 답 합치기</b> — 모아불리 로그인한 부부는 각자 답하면 저절로
            합쳐져요. 로그인 안 했으면 「배우자에게 보내기」 링크로 합쳐요.
          </li>
          <li>
            <b className="text-ink">③ 궁합 카드 캡처</b> — 둘 다 답하면 「우리 결과」에 궁합 점수와
            생각이 다른 것이 나와요.
          </li>
        </ol>
      </ShareSection>

      <ShareSection no={2} title="체크리스트 50">
        {cloud ? (
          <p className="mb-3 rounded-2xl bg-[#EAF7EE] px-4 py-3 text-[14px] font-bold leading-relaxed text-[#1E7A3C]">
            모아불리 로그인 중 ✓ 내 답은 우리 집 계정에 저장되고, 배우자 답과 저절로 합쳐져요.
          </p>
        ) : arrived ? (
          <p className="mb-3 rounded-2xl bg-[#EAF7EE] px-4 py-3 text-[14px] font-bold leading-relaxed text-[#1E7A3C]">
            {NAME[arrived]} 답이 도착했어요 ✓ 이제 {NAME[other(arrived)]} 답만 하면 결과가 열려요.
          </p>
        ) : (
          !authed && (
            <div className="mb-3 flex items-center gap-3 rounded-2xl bg-bg px-4 py-3">
              <p className="flex-1 text-[13px] leading-relaxed text-sub">
                모아불리 쓰는 부부라면 로그인하면 각자 답이 저절로 합쳐져요.
              </p>
              <button
                type="button"
                onClick={goLogin}
                className="shrink-0 rounded-xl bg-ink px-3 py-2 text-[13px] font-bold text-white"
              >
                로그인
              </button>
            </div>
          )
        )}
        {!me ? (
          <div className="rounded-2xl bg-bg p-4 text-center">
            <p className="text-[16px] font-extrabold text-ink">나는 누구예요?</p>
            <p className="mt-1 text-[13px] text-sub">이 폰에서는 고른 사람 칸만 체크해요.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["w", "h"] as Who[]).map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setMe(x)}
                  className={`rounded-2xl py-4 text-[17px] font-extrabold ${x === "w" ? "bg-[#FFE3EC] text-[#E0457B]" : "bg-[#E3EAFF] text-[#2F4AA8]"}`}
                >
                  {x === "w" ? "아내예요" : "남편이에요"}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="sticky top-0 z-10 -mx-1 mb-2 flex items-center gap-2 bg-card px-1 py-2">
              <span
                className={`rounded-full px-3 py-1 text-[13px] font-extrabold ${me === "w" ? "bg-[#FFE3EC] text-[#E0457B]" : "bg-[#E3EAFF] text-[#2F4AA8]"}`}
              >
                {NAME[me]} 답
              </span>
              <span className="text-[13px] font-bold text-sub">
                {myDone}/{N}
              </span>
              {!cloud && !arrived && (
                <button
                  type="button"
                  onClick={() => setMe(other(me))}
                  className="ml-auto text-[12px] text-cap underline"
                >
                  {NAME[other(me)]} 칸으로 바꾸기
                </button>
              )}
            </div>
            <div className="space-y-5">
              {GROUPS.map((g) => (
                <div key={g.title}>
                  <p className="mb-1.5 text-[14px] font-extrabold text-ink">
                    {g.emoji} {g.title}
                  </p>
                  <ul className="divide-y divide-line rounded-2xl bg-bg">
                    {g.items.map((t) => {
                      const i = idx++;
                      const v = ans[me][i];
                      return (
                        <li key={i} className="flex items-center gap-2 px-3 py-2.5">
                          <span className="w-6 shrink-0 text-[12px] font-bold text-cap">{i + 1}</span>
                          <span className="min-w-0 flex-1 text-[15px] leading-snug text-ink">{t}</span>
                          <Choice on={v === 1} tone={me} onClick={() => pick(i, 1)} label={`${i + 1}번 그렇다`}>
                            ○
                          </Choice>
                          <Choice on={v === 2} tone={me} onClick={() => pick(i, 2)} label={`${i + 1}번 아니다`}>
                            ✕
                          </Choice>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </ShareSection>

      <ShareSection no={3} title="우리 결과">
        {!me ? (
          <p className="rounded-2xl bg-bg px-4 py-3 text-[14px] text-sub">먼저 위에서 아내·남편을 골라 주세요.</p>
        ) : !partnerDone ? (
          <>
            <p className="rounded-2xl bg-bg px-4 py-3 text-[14px] leading-relaxed text-sub">
              {NAME[partner!]} 답이 아직 없어요.{" "}
              {cloud
                ? `${NAME[partner!]}도 모아불리에 로그인해서 이 페이지에서 답하면 저절로 합쳐져요.`
                : `내 답(${myDone}/${N})을 보내 주면, 받은 폰에서 답한 뒤 결과가 열려요.`}
            </p>
            <ShareButton
              copied={copied}
              onClick={share}
              label={cloud ? `${NAME[partner!]}에게 페이지 보내기` : `${NAME[partner!]}에게 내 답 보내기`}
            />
          </>
        ) : !showResult ? (
          <>
            <p className="rounded-2xl bg-[#FFF4F7] px-4 py-3 text-[14px] leading-relaxed text-ink">
              {NAME[partner!]} 답 {partnerDone}개가 와 있어요. 내 답({myDone}/{N})을 다 하면 궁합 결과가 열려요.
            </p>
            <button type="button" onClick={() => setPeek(true)} className="mt-2 w-full py-2 text-[13px] text-cap underline">
              다 안 했어도 지금 결과 보기
            </button>
          </>
        ) : (
          <>
            <MatchCard m={match} />
            <p className="mt-2 text-center text-[12px] text-cap">📸 이 카드를 캡처해서 남겨 두세요</p>
            {diffList.length > 0 ? (
              <div className="mt-4 rounded-2xl bg-[#FFF4F7] p-4">
                <p className="text-[15px] font-extrabold text-ink">이것부터 이야기해 보세요</p>
                <ul className="mt-2 space-y-1.5">
                  {diffList.map((i) => (
                    <li key={i} className="flex gap-2 text-[14px] leading-snug text-ink">
                      <span className="shrink-0 font-bold text-[#E0457B]">{i + 1}</span>
                      <span className="flex-1">{ITEMS[i]}</span>
                      <span className="shrink-0 text-sub">
                        아내 {wife[i] === 1 ? "○" : "✕"} · 남편 {husband[i] === 1 ? "○" : "✕"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 rounded-2xl bg-bg px-4 py-3 text-[14px] text-sub">
                둘 다 답한 건 생각이 다 같아요 🙌
              </p>
            )}
            <ShareButton copied={copied} onClick={share} label={`${NAME[partner!]}에게 결과 보내기`} />
          </>
        )}
        <button type="button" onClick={reset} className="mt-2 w-full py-2 text-[13px] text-cap underline">
          {cloud ? "내 답 모두 지우기" : "이 폰의 답 모두 지우기"}
        </button>
      </ShareSection>
    </ShareArticle>
  );
}

/** 캡처용 궁합 카드 — 한 화면(폰 세로)에 다 들어가게 */
function MatchCard({ m }: { m: ValuesMatch }) {
  return (
    <div className="overflow-hidden rounded-3xl bg-[#1B2433] px-5 pb-5 pt-6 text-white">
      <p className="text-center text-[13px] font-bold tracking-wide text-[#AEB8C7]">우리 부부 재테크 궁합</p>
      <p className="mt-1 text-center text-[64px] font-black leading-none">
        {m.percent}
        <span className="text-[30px]">%</span>
      </p>
      <p className="mt-2 text-center text-[20px] font-extrabold text-[#FFD66B]">{m.label}</p>
      <p className="mt-1 text-center text-[14px] text-[#D5DBE4]">{m.line}</p>
      <p className="mt-1 text-center text-[12px] text-[#8E99A9]">
        둘 다 답한 {m.both}개 중 {m.same}개가 같아요
      </p>
      <ul className="mt-5 space-y-2">
        {m.groups.map((g) => {
          const r = g.both ? g.same / g.both : 0;
          return (
            <li key={g.title} className="flex items-center gap-2 text-[13px]">
              <span className="w-[92px] shrink-0 truncate">
                {g.emoji} {g.title}
              </span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <span
                  className={`block h-full rounded-full ${r >= 0.75 ? "bg-[#7FD8A6]" : r >= 0.5 ? "bg-[#FFD66B]" : "bg-[#FF8FB1]"}`}
                  style={{ width: `${g.both ? Math.max(6, r * 100) : 0}%` }}
                />
              </span>
              <span className="w-9 shrink-0 text-right text-[12px] text-[#AEB8C7]">
                {g.both ? `${g.same}/${g.both}` : "—"}
              </span>
            </li>
          );
        })}
      </ul>
      {m.best && m.worst && m.best !== m.worst && (
        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl bg-white/10 px-2 py-2.5">
            <p className="text-[11px] text-[#AEB8C7]">제일 잘 맞는 주제</p>
            <p className="mt-0.5 text-[15px] font-extrabold">
              {m.best.emoji} {m.best.title}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 px-2 py-2.5">
            <p className="text-[11px] text-[#AEB8C7]">제일 다른 주제</p>
            <p className="mt-0.5 text-[15px] font-extrabold text-[#FF8FB1]">
              {m.worst.emoji} {m.worst.title}
            </p>
          </div>
        </div>
      )}
      <p className="mt-5 text-center text-[11px] text-[#8E99A9]">moabuli.com/values · 결영이네 부부 체크리스트</p>
    </div>
  );
}

function ShareButton({ copied, onClick, label }: { copied: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 w-full rounded-2xl bg-brand px-5 py-4 text-[17px] font-extrabold text-white"
    >
      {copied ? "링크 복사했어요 ✓ 카톡에 붙여넣으세요" : label}
    </button>
  );
}

function Choice({
  on,
  tone,
  onClick,
  label,
  children,
}: {
  on: boolean;
  tone: Who;
  onClick: () => void;
  label: string;
  children: string;
}) {
  const color = tone === "w" ? "bg-[#FFE3EC] text-[#E0457B] border-[#FFB3C9]" : "bg-[#E3EAFF] text-[#2F4AA8] border-[#B3C3F5]";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      className={`flex h-10 w-11 shrink-0 items-center justify-center rounded-xl border text-[20px] font-extrabold ${on ? color : "border-line bg-white text-[#C9CDD4]"}`}
    >
      {children}
    </button>
  );
}
