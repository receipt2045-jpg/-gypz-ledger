import type { ReactNode } from "react";
import ShareArticle, {
  ShareHero,
  ShareSection,
} from "../components/ShareArticle";

/**
 * 쿠팡에서 돈 돌려받는 법 (2026-11-09) — 로그인 없이 열리는 공개 페이지.
 * 릴스 「쿠팡에서 월 100 쓰는 애엄마 꿀팁」 댓글 '쿠팡'으로 받은 사람이 들어온다.
 * 하수(폴센트 최저가 알림) → 중수(스탬플리 기프티콘) → 고수(키움증권 거쳐서 2% → 현금) 순서.
 * 적립률·조건은 자주 바뀌어서 숫자는 기사·앱 안내로 확인한 것만, 기준일과 함께 적는다.
 */
export default function Coupang() {
  return (
    <ShareArticle
      kind="guide"
      toc={[
        { no: 1, title: "한눈에 보기" },
        { no: 2, title: "하수 · 폴센트로 최저가 알림 받기" },
        { no: 3, title: "중수 · 스탬플리 거쳐서 사기" },
        { no: 4, title: "고수 · 키움증권 거쳐서 2% 현금으로" },
        { no: 5, title: "적립 놓치지 않으려면" },
      ]}
      hero={
        <ShareHero
          kicker="결영이네 쿠팡 꿀팁"
          title={
            <>
              쿠팡에서 쓴 돈,
              <br />
              돌려받는 3가지
            </>
          }
          lead={
            <>
              같은 물건을 사도 어디를 거쳐서 사느냐에 따라
              <br />
              <b className="font-bold text-[#FFD66B]">기프티콘</b>이 되기도,{" "}
              <b className="font-bold text-[#FFD66B]">현금</b>이 되기도 해요.
            </>
          }
        />
      }
      sources={
        <>
          <p className="font-semibold text-sub">자료 출처</p>
          <ul className="mt-1.5 space-y-1">
            <li>· 폴센트 — 앱스토어 소개(가격 변동·최저가 알림, 무료)</li>
            <li>
              · 스탬플리 — 앱스토어 소개(경유 쇼핑 혜택), 사용 후기 기준 결제
              3만 원당 스탬프 1개·하루 10개까지
            </li>
            <li>
              · 키움증권 — 영웅문S#에서 쿠팡에 들어가 사면 결제금액 2%
              키움포인트 적립(디지털데일리·전자신문 2026년 9월 보도). 포인트 →
              현금 전환·출금은 결영이네가 11월 8일 앱에서 직접 해 봤어요
            </li>
            <li>
              · 하나증권 — 하나증권V &lsquo;쇼핑적립&rsquo; 쿠팡 결제금액 3%,
              별포인트는 주식매수쿠폰으로 교환(2026년 10월 7일 출시 보도)
            </li>
          </ul>
          <p className="mt-3">
            11월 9일 기준이에요. 적립률·한도·적립 시점은 자주 바뀌니 쓰기 전에
            앱 안내를 한 번 더 봐 주세요. 광고나 제휴 글이 아니고, 투자를 권하는
            글도 아니에요.
          </p>
        </>
      }
    >
      {/* ── 1. 한눈에 */}
      <ShareSection no={1} title="한눈에 보기">
        <div className="space-y-2.5">
          <Level
            badge="🥉 하수"
            name="폴센트"
            icon="icon-fallcent"
            what="담아두면 최저가일 때 알림"
            back="싸게 사서 아끼는 돈"
          />
          <Level
            badge="🥈 중수"
            name="스탬플리"
            icon="icon-stamply"
            what="거쳐서 사면 3만 원마다 스탬프"
            back="기프티콘"
          />
          <Level
            badge="🥇 고수"
            name="키움증권"
            icon="icon-kiwoom"
            what="거쳐서 사면 결제금액 2% 적립"
            back="현금으로 바꿔 내 통장에"
            best
          />
        </div>
        <p className="mt-3 rounded-xl bg-bg px-4 py-3 text-[14px] leading-relaxed text-sub">
          💡 폴센트로 싸게 살 때를 알고, 살 때는 적립되는 곳 한 군데를 거쳐서
          들어가요.
        </p>
      </ShareSection>

      {/* ── 2. 폴센트 */}
      <ShareSection no={2} title="하수 · 폴센트로 최저가 알림 받기">
        <ol className="space-y-3">
          <Step n={1} title="폴센트 앱 깔기">
            앱스토어·플레이스토어에서 &lsquo;폴센트&rsquo;를 찾아요. 무료예요.
          </Step>
          <Step n={2} title="쿠팡 상품을 폴센트로 공유">
            쿠팡 앱 상품 화면에서 공유 버튼 → 폴센트를 누르면 가격을 따라가기
            시작해요.
          </Step>
          <Step n={3} title="최저가 알림 오면 사기">
            가격 그래프로 지금이 싼 때인지 볼 수 있어요. 기저귀·물티슈처럼 매달
            사는 건 알림 왔을 때 쟁여두기 좋아요.
          </Step>
        </ol>
        <Store
          file="fallcent-store"
          alt="폴센트 앱 소개 화면"
          caption="폴센트 앱 (앱스토어 소개 화면)"
        />
      </ShareSection>

      {/* ── 3. 스탬플리 */}
      <ShareSection no={3} title="중수 · 스탬플리 거쳐서 사기">
        <ol className="space-y-3">
          <Step n={1} title="스탬플리 앱 깔고 쿠팡 고르기">
            쿠팡을 바로 열지 말고 스탬플리 앱에서 쿠팡을 눌러 들어가요.
          </Step>
          <Step n={2} title="들어간 김에 바로 결제">
            결제 금액 3만 원마다 스탬프가 1개씩 쌓여요. 하루에 10개까지예요.
          </Step>
          <Step n={3} title="스탬프 모아서 기프티콘으로">
            커피 같은 기프티콘으로 바꿔요. 기프티콘은 쓸 수 있는 기간이 짧은
            편이라 받으면 바로 써요.
          </Step>
        </ol>
        <Store
          file="stamply-store"
          alt="스탬플리 앱 소개 화면"
          caption="스탬플리 앱 (앱스토어 소개 화면)"
        />
      </ShareSection>

      {/* ── 4. 키움증권 */}
      <ShareSection no={4} title="고수 · 키움증권 거쳐서 2% 현금으로">
        <ol className="space-y-3">
          <Step n={1} title="키움증권 영웅문S# 앱 깔기">
            주식 안 해도 돼요. 계좌만 있으면 쇼핑 적립을 쓸 수 있어요.
          </Step>
          <Step n={2} title="'혜택' 메뉴에서 쿠팡 배너 누르기">
            앱 아래 혜택(생활/혜택) 메뉴 → 쿠팡을 눌러 쿠팡으로 넘어가요.
          </Step>
          <Step n={3} title="넘어간 쿠팡에서 그대로 결제">
            결제금액의 <b className="text-ink">2%</b>가 키움포인트로 쌓여요.
          </Step>
          <Step n={4} title="포인트를 현금으로 바꾸기">
            포인트 화면에서 &lsquo;현금으로 전환&rsquo;을 누르면 증권 계좌에
            현금으로 들어와요.
          </Step>
          <Step n={5} title="내 통장으로 보내기">
            메뉴 → 보내기(출금)에서 쓰는 은행 계좌로 보내면 끝이에요.
          </Step>
        </ol>
        <p className="mt-4 text-[14px] font-bold text-ink">
          결영이네가 직접 해 본 화면
        </p>
        <div className="mt-2 space-y-3">
          <Shot
            file="kiwoom-1-convert"
            alt="키움증권 포인트를 현금으로 전환하는 화면"
            caption="① 포인트 화면에서 현금으로 전환"
          />
          <Shot
            file="kiwoom-2-done"
            alt="15,162포인트가 15,162원으로 전환된 화면"
            caption="② 15,162원 전환 완료"
          />
          <Shot
            file="kiwoom-3-send"
            alt="키움증권 메뉴의 보내기(출금)"
            caption="③ 메뉴 → 보내기(출금)으로 내 통장에"
          />
        </div>
        <div className="mt-4 rounded-2xl bg-ink px-5 py-4 text-white">
          <p className="text-[18px] font-extrabold leading-snug">
            한 달 100만 원 쓰면 2만 원
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-white/75">
            결영이네도 이번에 쿠팡 포인트 <b className="text-white">15,162원</b>
            을 현금으로 바꿔서 통장으로 받았어요.
          </p>
          <img
            src="/share/coupang/deposit.webp"
            alt="통장에 쿠팡 포인트 15,162원이 들어온 내역"
            loading="lazy"
            className="mt-3 w-full rounded-xl"
          />
        </div>
        <p className="mt-3 rounded-xl bg-bg px-4 py-3 text-[14px] leading-relaxed text-sub">
          참고로 하나증권V &lsquo;쇼핑적립&rsquo;은 쿠팡 결제금액의{" "}
          <b className="text-ink">3%</b>를 쌓아 줘요. 대신 현금이 아니라 주식 살
          때 쓰는 쿠폰으로 바꿔요.
        </p>
      </ShareSection>

      {/* ── 5. 주의 */}
      <ShareSection no={5} title="적립 놓치지 않으려면">
        <div className="space-y-3">
          <Tip title="꼭 거쳐서 들어간 뒤 바로 결제">
            쿠팡 앱을 따로 열거나, 다른 앱을 거쳐 들어가면 적립이 안 될 수
            있어요.
          </Tip>
          <Tip title="장바구니에 오래 담아둔 건 다시 담기">
            미리 담아둔 상품은 적립에서 빠질 수 있다는 후기가 있어요. 거쳐
            들어간 뒤 담고 바로 결제해요.
          </Tip>
          <Tip title="적립은 바로 안 들어와요">
            언제 들어오는지, 한도가 얼마인지는 앱 안내에 적혀 있어요. 처음엔
            작은 금액으로 한 번 해 봐요.
          </Tip>
        </div>
      </ShareSection>
    </ShareArticle>
  );
}

function Level({
  badge,
  name,
  icon,
  what,
  back,
  best = false,
}: {
  badge: string;
  name: string;
  icon: string;
  what: string;
  back: string;
  best?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-3.5 ${best ? "bg-[#F2F7FF]" : "bg-bg"}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="flex items-center text-[16px] font-extrabold text-ink">
          <img
            src={`/share/coupang/${icon}.webp`}
            alt=""
            className="mr-2 h-7 w-7 shrink-0 rounded-lg"
          />
          <span className="mr-1.5 text-[13px] font-bold text-sub">{badge}</span>
          {name}
        </p>
        <p
          className={`text-right text-[14px] font-extrabold ${best ? "text-brand" : "text-ink"}`}
        >
          {back}
        </p>
      </div>
      <p className="mt-1 text-[14px] text-sub">{what}</p>
    </div>
  );
}

/** 결영이네가 직접 찍은 앱 화면 (계좌번호·이름 나오는 부분은 잘라냈다) */
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
        src={`/share/coupang/${file}.webp`}
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

/** 앱스토어 소개 화면 */
function Store({
  file,
  alt,
  caption,
}: {
  file: string;
  alt: string;
  caption: string;
}) {
  return (
    <figure className="mt-4 flex flex-col items-center">
      <img
        src={`/share/coupang/${file}.webp`}
        alt={alt}
        loading="lazy"
        className="w-[46%] rounded-2xl border border-line"
      />
      <figcaption className="mt-1.5 text-[12px] text-sub">{caption}</figcaption>
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
