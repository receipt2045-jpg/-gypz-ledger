import { useState, type ReactNode } from "react";
import ShareArticle, {
  ShareHero,
  ShareSection,
} from "../components/ShareArticle";

/**
 * AI 비서로 기프티콘 설문 자동 응모 (2026-11-19) — 로그인 없이 열리는 공개 페이지.
 * 릴스 「커피값 AI 설문 응모」 댓글로 앱·명령어를 물은 사람이 들어온다.
 * 피클(결영이네 초대 링크) 깔기 → 명령어 복사·붙여넣기 → 응모할 사람 정보만 바꾸기.
 * 숫자(2주·261건·이마트 1만 원 당첨)는 결영이네 실제 화면 그대로.
 */
const INVITE = "https://pickle.com/i/LFBVRKG5";

const COMMAND = `앞으로 매일 오전 10시, 오후 2시(하루 2번)마다 기프티콘·상품권 주는 온라인 설문조사랑 퀴즈 이벤트 찾아서 대리 응모해 줘.

[응모할 사람 정보]
1. 이름 / 010-0000-0000 / 성별 / 00대(만 00세) / 거주 시·군·구
(가족 명의 추가 시 같은 형식으로 2, 3번 적기)

[찾는 곳 & 검색 방법]
• 이벤트 모음 사이트: 모아득, 픽모아, 슈퍼투데이, 이벤트하우스의 설문·퀴즈 게시판
• 공공기관·지자체: 소통24, 국민생각함, 지자체·공기업 공지사항 (자체 로그인 필요한 건 빼고, 본문에 네이버폼·구글폼·모아폼 외부 링크 달린 것 위주로)
• 추가 검색: form.naver.com, docs.google.com/forms, moaform.com 주소랑 "만족도", "기프티콘", "상품권", "추첨" 키워드 조합해서 커뮤니티에 안 올라온 신규 설문까지 발굴

[응모 기준 & 규칙]
• 금액 작아도(캔커피, 편의점 쿠폰 등) 소액 기프티콘 주는 건 가리지 말고 전부 참여
• SNS 팔로우·댓글·인증샷 업로드 같은 수동 미션이나 회원 로그인 필수 건은 제외
• 거주지 제한 없는 전국민/온라인 대상이거나 내 거주 지역에 맞는 것만 참여
• 여러 명 넣을 땐 만족도 점수나 주관식 개선의견을 조금씩 다르게 성의 있게 작성
• 이미 응모한 설문은 따로 기록해 두고 중복 참여하지 않기
• 새로 응모 완료한 것만 설문명, 경품, 발표일, 응모 인원으로 정리해서 보고해 줘`;

export default function Survey() {
  return (
    <ShareArticle
      kind="guide"
      toc={[
        { no: 1, title: "한눈에 보기" },
        { no: 2, title: "피클 앱 깔기" },
        { no: 3, title: "명령어 복사해서 붙여넣기" },
        { no: 4, title: "응모할 사람 정보 바꾸기" },
        { no: 5, title: "알아두면 좋은 것" },
      ]}
      hero={
        <ShareHero
          kicker="결영이네 앱테크"
          title={
            <>
              커피값,
              <br />
              AI 비서가 벌어와요
            </>
          }
          lead={
            <>
              기프티콘 주는 설문, 하루 2번 AI가 찾아서{" "}
              <b className="font-bold text-[#FFD66B]">대신 응모</b>해요.
              <br />
              한 번만 세팅하면 끝이에요.
            </>
          }
        />
      }
      sources={
        <>
          <p className="font-semibold text-sub">알려 드려요</p>
          <ul className="mt-1.5 space-y-1">
            <li>
              · 피클 링크는 결영이네 <b className="text-ink">초대 링크</b>
              예요. 앱스토어에서 &lsquo;피클&rsquo;을 찾아 깔아도 똑같이 쓸 수
              있어요.
            </li>
            <li>
              · 2주·누적 261건·이마트 1만 원권 당첨은 결영이네 AI 비서 화면
              그대로예요(11월 기준). 설문 이벤트는 추첨이라 응모한 만큼 다
              당첨되지는 않아요.
            </li>
          </ul>
          <p className="mt-3">
            11월 19일 기준이에요. 설문 이벤트는 주최하는 곳마다 조건이 달라요.
          </p>
        </>
      }
    >
      {/* ── 1. 한눈에 */}
      <ShareSection no={1} title="한눈에 보기">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat big="하루 2번" small="오전 10시 · 오후 2시" />
          <Stat big="2주" small="세팅하고 지난 시간" />
          <Stat big="261건" small="누적 응모" best />
        </div>
        <p className="mt-4 text-[14px] font-bold text-ink">
          결영이네 AI 비서 화면
        </p>
        <div className="mt-2 space-y-3">
          <Shot
            file="chat-request"
            alt="매일 10시, 2시에 기프티콘 설문 찾아서 알아서 다 응모해 줘! 라고 보낸 메시지"
            caption="① 처음 한 번 시킨 말"
          />
          <Shot
            file="chat-261"
            alt="오후 2시 설문 접수 완료, 신규 4곳 접수, 누적 261건"
            caption="② 하루 2번 이렇게 보고가 와요"
          />
          <Shot
            file="chat-win"
            alt="이마트 1만 원 상품권 당첨 메시지"
            caption="③ 이마트 1만 원 상품권 당첨"
          />
        </div>
        <div className="mt-4 rounded-2xl bg-ink px-5 py-4 text-white">
          <p className="text-[18px] font-extrabold leading-snug">
            내가 한 건 0개, AI가 벌어온 쿠폰들
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-white/75">
            이마트 1만 원권에 메가커피까지 쌓이고 있어요. 안 먹는 건 되팔아서
            현금으로 바꿔도 돼요.
          </p>
          <img
            src="/share/survey/wallet.webp"
            alt="이마트 상품권과 메가커피 아메리카노 기프티콘이 쌓인 쿠폰함"
            loading="lazy"
            className="mt-3 w-full rounded-xl"
          />
        </div>
      </ShareSection>

      {/* ── 2. 피클 */}
      <ShareSection no={2} title="피클 앱 깔기">
        <ol className="space-y-3">
          <Step n={1} title="아래 버튼으로 피클 들어가기">
            결영이네 초대 링크예요. 폰에서 누르면 앱 설치 화면으로 넘어가요.
          </Step>
          <Step n={2} title="가입하고 AI 비서 대화창 열기">
            앱에서 AI 비서한테 말 거는 대화창을 열어 두세요. 여기에 3번 명령어를
            붙여넣을 거예요.
          </Step>
        </ol>
        <a
          href={INVITE}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex w-full items-center justify-center rounded-2xl bg-brand px-5 py-4 text-[17px] font-extrabold text-white"
        >
          피클 초대 링크 열기 →
        </a>
        <p className="mt-2 text-center text-[13px] text-sub">{INVITE}</p>
      </ShareSection>

      {/* ── 3. 명령어 */}
      <ShareSection no={3} title="명령어 복사해서 붙여넣기">
        <p className="text-[15px] leading-relaxed text-sub">
          결영이네가 실제로 쓰는 명령어 그대로예요. 복사해서 AI 비서 대화창에
          붙여넣고, <b className="text-ink">[응모할 사람 정보]</b> 줄만 내
          정보로 바꿔서 보내면 끝이에요.
        </p>
        <CopyBox text={COMMAND} />
      </ShareSection>

      {/* ── 4. 정보 */}
      <ShareSection no={4} title="응모할 사람 정보 바꾸기">
        <div className="rounded-2xl bg-bg p-4">
          <p className="text-[13px] font-bold text-sub">이렇게 바꿔요 (예시)</p>
          <p className="mt-1.5 text-[14px] font-semibold leading-relaxed text-ink">
            1. 홍길동 / 010-1234-5678 / 여 / 30대(만 32세) / 서울 송파구
          </p>
        </div>
        <div className="mt-3 space-y-3">
          <Tip title="거주 지역은 꼭 적기">
            지자체 설문은 그 지역 사람만 참여할 수 있어요. 시·군·구까지 적어야
            AI가 맞는 것만 골라요.
          </Tip>
          <Tip title="가족도 넣을 땐 동의 먼저">
            남편·부모님 이름으로도 응모할 수 있어요. 같은 형식으로 2, 3번에
            적되, 이름과 번호를 넣기 전에 꼭 물어보고 넣어요.
          </Tip>
        </div>
      </ShareSection>

      {/* ── 5. 주의 */}
      <ShareSection no={5} title="알아두면 좋은 것">
        <div className="space-y-3">
          <Tip title="당첨은 문자로 와요">
            기프티콘은 응모할 때 적은 번호로 와요. 모르는 번호 문자도 한 번씩
            확인해요.
          </Tip>
          <Tip title="추첨이라 다 되진 않아요">
            응모를 많이 할수록 당첨도 늘어요. 금액이 작아도 다 넣는 게 명령어에
            들어 있는 이유예요.
          </Tip>
          <Tip title="이름·번호는 설문 주최하는 곳으로 가요">
            로그인 필요한 곳과 SNS 미션은 빼라고 명령어에 넣어 뒀어요. 보고
            온 설문명이 낯설면 한 번 찾아봐요.
          </Tip>
        </div>
      </ShareSection>
    </ShareArticle>
  );
}

function CopyBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => undefined);
  };
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-line">
      <div className="flex items-center justify-between bg-bg px-4 py-2.5">
        <p className="text-[13px] font-bold text-sub">설문 자동 응모 명령어</p>
        <button
          type="button"
          onClick={copy}
          className="rounded-full bg-brand px-3.5 py-1.5 text-[13px] font-bold text-white"
        >
          {copied ? "복사했어요 ✓" : "복사하기"}
        </button>
      </div>
      <pre style={{ fontFamily: "inherit" }} className="max-h-[420px] overflow-auto whitespace-pre-wrap break-keep bg-white px-4 py-3.5 text-[13.5px] leading-relaxed text-ink">
        {text}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="w-full border-t border-line bg-white py-3 text-[15px] font-extrabold text-brand"
      >
        {copied ? "복사했어요 ✓ 대화창에 붙여넣으세요" : "명령어 전체 복사하기"}
      </button>
    </div>
  );
}

function Stat({
  big,
  small,
  best = false,
}: {
  big: string;
  small: string;
  best?: boolean;
}) {
  return (
    <div className={`rounded-2xl px-2 py-3.5 ${best ? "bg-[#F2F7FF]" : "bg-bg"}`}>
      <p
        className={`text-[19px] font-extrabold ${best ? "text-brand" : "text-ink"}`}
      >
        {big}
      </p>
      <p className="mt-0.5 text-[12px] leading-snug text-sub">{small}</p>
    </div>
  );
}

/** 결영이네 실제 화면 (이름은 흐리게 했다) */
function Shot({
  file,
  alt,
  caption,
}: {
  file: string;
  alt: string;
  caption: string;
}) {
  return (
    <figure>
      <img
        src={`/share/survey/${file}.webp`}
        alt={alt}
        loading="lazy"
        className="w-full rounded-xl border border-line bg-white"
      />
      <figcaption className="mt-1.5 text-center text-[13px] leading-snug text-sub">
        {caption}
      </figcaption>
    </figure>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-2xl bg-bg p-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[14px] font-extrabold text-brand">
        {n}
      </span>
      <div>
        <p className="text-[16px] font-bold text-ink">{title}</p>
        <p className="mt-0.5 text-[14px] leading-relaxed text-sub">
          {children}
        </p>
      </div>
    </li>
  );
}

function Tip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-bg p-4">
      <p className="text-[16px] font-extrabold text-ink">{title}</p>
      <p className="mt-1 text-[15px] leading-relaxed text-sub">{children}</p>
    </div>
  );
}
