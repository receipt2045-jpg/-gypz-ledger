import type { ReactNode } from "react";
import ShareArticle, {
  ShareHero,
  ShareSection,
} from "../components/ShareArticle";

const DISCLOSURE =
  "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

/**
 * 모락셀라균 세탁세제 6종 가격·성분 비교 (2026-11-27) — 로그인 없이 열리는 공개 페이지.
 * 원고: 노션 받은함 「[모아불리] 모락셀라균 세탁세제 6종 가격·성분 비교 자료」(피클, 11-17 쿠팡 기준).
 * 수건 냄새 릴스(11-28) 댓글 나눔용. 가격·성분은 원고 그대로, 공개 안 된 성분은 '미공개'로 두고 추측하지 않는다.
 * 쿠팡 파트너스 링크는 검색 API로 찾은 4종에만(피지 액체 2.1L·프로쉬 제로는 같은 상품이 안 나와 링크 없음). 대가성 문구 같이.
 */

interface Item {
  name: string;
  spec: string;
  price: string;
  unit: string;
  calc: string;
  ingr: string;
  note: string;
  pick?: boolean;
  /** 쿠팡 파트너스 링크 (11-27 검색 API로 받음, 상품명 확인함) */
  url?: string;
}

// 11-17 쿠팡 판매가 기준 — 캡슐은 개당, 액체는 100ml당으로 환산
const CAPSULES: Item[] = [
  {
    name: "랩신 냄새제거 부스터 무향 캡슐",
    url: "https://link.coupang.com/re/AFFSDP?lptag=AF0616599&subid=moabuli&pageKey=8812083389&itemId=25679476355&vendorItemId=92668851485&traceid=V0-153-6daa5bfb9dd864bb&requestid=20261127144627646249228251&token=31850C%7CMIXED&pt=0&slot=4",
    spec: "25개입",
    price: "12,350원",
    unit: "개당 494원",
    calc: "12,350 ÷ 25 = 494원",
    ingr: "무향 · 모락셀라균 케어 · 알레르기 물질 26종·피부걱정 성분 7종 무첨가 · 독일 더마테스트 엑설런트",
    note: "저희가 실제로 산 것. 무향에 무첨가 성분 개수와 피부 시험까지 공개돼 있어요",
    pick: true,
  },
  {
    name: "리큐 모락셀라 악취케어 캡슐",
    url: "https://link.coupang.com/re/AFFSDP?lptag=AF0616599&subid=moabuli&pageKey=9726339807&itemId=29106390585&vendorItemId=92229485381&traceid=V0-153-397cecce61fa632c&requestid=20261127144639423082792860&token=31850C%7CMIXED&pt=0&slot=5",
    spec: "40개입",
    price: "12,590원",
    unit: "개당 약 315원",
    calc: "12,590 ÷ 40 = 314.75원",
    ingr: "국산 · 무형광증백제 · 무파라벤 · 피부자극 테스트 완료",
    note: "6종 중 개당 단가는 가장 낮아요. 다만 세부 향료 전성분은 온라인에 공개돼 있지 않아요",
  },
  {
    name: "피지 모락셀라 부스터 캡슐",
    url: "https://link.coupang.com/re/AFFSDP?lptag=AF0616599&subid=moabuli&pageKey=8770784219&itemId=25516487123&vendorItemId=92508392455&traceid=V0-153-d2688da1b7369eae&requestid=20261127144628009308350185&token=31850C%7CMIXED&pt=0&slot=4",
    spec: "26개입",
    price: "15,740원",
    unit: "개당 약 605원",
    calc: "15,740 ÷ 26 = 605.38원",
    ingr: "중국 OEM 제조 · 알레르기 향료 6종 포함",
    note: "향료 부담이 큰 편이에요",
  },
];

const LIQUIDS: Item[] = [
  {
    name: "랩신 항균 세탁세제 솔잎향",
    url: "https://link.coupang.com/re/AFFSDP?lptag=AF0616599&subid=moabuli&pageKey=7196287533&itemId=20226616320&vendorItemId=92529429021&traceid=V0-153-6f43483ef3f38e36&requestid=20261127144628346228131996&token=31850C%7CMIXED&pt=0&slot=4",
    spec: "2L",
    price: "12,900원",
    unit: "100ml당 645원",
    calc: "12,900 ÷ 2,000ml × 100 = 645원",
    ingr: "약산성 처방",
    note: "솔잎향이 있어요",
  },
  {
    name: "피지 모락셀라 액체",
    spec: "2.1L",
    price: "14,750원",
    unit: "100ml당 약 702원",
    calc: "14,750 ÷ 2,100ml × 100 = 702.38원",
    ingr: "BIT 보존제 · LAS · 알레르기 향료 4종 포함",
    note: "보존제·향료가 들어 있어요",
  },
  {
    name: "프로쉬 제로 액상 세탁세제",
    spec: "1.5L",
    price: "16,020원",
    unit: "100ml당 1,068원",
    calc: "16,020 ÷ 1,500ml × 100 = 1,068원",
    ingr: "무향 · 무색소 · ECARF 알레르기 안전 인증",
    note: "성분은 깔끔한데 6종 중 단가가 가장 높아요",
  },
];

const CHECKS: [string, string][] = [
  ["향료", "무향인지부터. 알레르기 향료 몇 종을 뺐는지 개수까지 공개한 제품을 먼저 봐요"],
  ["보존제", "BIT(벤조이소티아졸리논) 같은 논란 보존제, 파라벤이 없는지"],
  ["형광증백제", "'무형광증백제' 표기가 있는지"],
  ["피부 자극 검사", "피부자극 테스트, 독일 더마테스트, ECARF 같은 제3자 인증이 있는지"],
  ["단가", "캡슐은 개당, 액체는 100ml당으로 나눠서 비교. 향이 좋아도 단가가 2배면 탈락"],
];

export default function Moraxella() {
  return (
    <ShareArticle
      kind="guide"
      toc={[
        { no: 1, title: "결론부터" },
        { no: 2, title: "수건 쉰내, 모락셀라균이 뭐길래" },
        { no: 3, title: "캡슐 세제 3종" },
        { no: 4, title: "액체 세제 3종" },
        { no: 5, title: "아기 있는 집 체크리스트 5" },
      ]}
      hero={
        <ShareHero
          kicker="결영이네 짠순이 살림"
          title={
            <>
              모락셀라균 세탁세제
              <br />
              6종 비교
            </>
          }
          lead={
            <>
              수건 꿉꿉한 냄새 잡으려고,
              <br />
              <b className="font-bold text-[#FFD66B]">6종</b>을 성분·개당
              단가로 비교했습니다.
            </>
          }
        />
      }
      sources={
        <>
          <p className="font-semibold text-sub">자료 출처</p>
          <ul className="mt-1.5 space-y-1">
            <li>· 가격 — 쿠팡 판매가 (2026년 11월 17일 기준)</li>
            <li>· 성분·인증 — 각 제품 상세 페이지 표기</li>
            <li>
              · 모락셀라균 — Kubota 외, Applied and Environmental Microbiology
              78(9), 2012
            </li>
          </ul>
          <p className="mt-3">
            가격은 수시로 바뀝니다. 랩신 무향 캡슐은 구매 당시 프로모션으로
            11,700원(개당 468원)에 샀지만, 본문은 정가 12,350원 기준으로
            적었어요. 링크로 열리는 지금 가격·구성은 다를 수 있어요. {DISCLOSURE}
          </p>
        </>
      }
    >
      <ShareSection no={1} title="결론부터">
        <div className="rounded-2xl bg-[#F2F7FF] px-4 py-4">
          <p className="text-[17px] font-extrabold leading-snug text-ink">
            아기 키우는 집이면 향료·보존제부터, 캡슐은 개당 단가로.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-sub">
            저희는 <b className="text-ink">랩신 냄새제거 부스터 무향 캡슐</b>
            (25개입 12,350원, 개당 494원)으로 골랐어요.
          </p>
        </div>
        <div className="mt-3 space-y-2.5">
          <Point title="제일 싼 건 리큐, 그래도 랩신을 고른 이유">
            개당 단가는 리큐가 약 315원으로 가장 낮아요. 다만 향료 전성분이
            공개돼 있지 않아서, 무향에 무첨가 성분 개수와 피부 시험까지 공개한
            랩신(494원)을 아기 빨래 기준으로 골랐어요.
          </Point>
          <Point title="향으로 덮지 말고 균부터">
            섬유유연제로 냄새를 덮어도 균은 그대로 남아요. 세제는 '원인균
            케어'를 먼저 보고, 향은 맨 나중에 봤어요.
          </Point>
        </div>
      </ShareSection>

      <ShareSection no={2} title="수건 쉰내, 모락셀라균이 뭐길래">
        <div className="space-y-2.5">
          <Point title="사람 피부에 흔한 균이에요">
            모락셀라균(Moraxella osloensis)은 피부나 물에 흔한 세균이에요.
            빨래한 뒤 수건·옷에서도 자주 나와요.
          </Point>
          <Point title="피지를 먹고 '젖은 걸레 냄새'를 만들어요">
            수건에 남은 피지를 분해하면서 4-메틸-3-헥센산이라는 물질을
            만드는데, 이게 꿉꿉한 걸레 냄새의 정체예요. 2012년 일본 가오
            연구팀이 빨래 쉰내의 주범으로 밝혔어요.
          </Point>
          <Point title="그래서 물만 닿으면 또 냄새가 나요">
            일반 세제로 빨아도 섬유 속에 남아 있다가, 젖으면 다시 냄새가
            올라와요. 고온 세탁에 원인균을 잡는 세제를 같이 쓰는 이유예요.
          </Point>
        </div>
      </ShareSection>

      <ShareSection no={3} title="캡슐 세제 3종 — 개당 단가">
        <p className="rounded-xl border border-[#FFD66B] bg-[#FFF8E1] px-4 py-3 text-[13px] font-semibold leading-relaxed text-ink">
          {DISCLOSURE}
        </p>
        <div className="mt-3 space-y-3">
          {CAPSULES.map((it) => (
            <ItemCard key={it.name} it={it} />
          ))}
        </div>
      </ShareSection>

      <ShareSection no={4} title="액체 세제 3종 — 100ml당 단가">
        <p className="text-[14px] leading-relaxed text-sub">
          캡슐과 액체는 단위가 달라서 숫자끼리 바로 비교하지 않았어요.
        </p>
        <div className="mt-3 space-y-3">
          {LIQUIDS.map((it) => (
            <ItemCard key={it.name} it={it} />
          ))}
        </div>
      </ShareSection>

      <ShareSection no={5} title="아기 있는 집 체크리스트 5">
        <ol className="space-y-2.5">
          {CHECKS.map(([k, v], i) => (
            <li key={k} className="flex gap-3 rounded-2xl bg-bg px-4 py-3.5">
              <span className="text-[17px] font-extrabold text-brand">
                {i + 1}
              </span>
              <div>
                <p className="text-[16px] font-extrabold text-ink">{k}</p>
                <p className="mt-0.5 text-[14px] leading-relaxed text-sub">
                  {v}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </ShareSection>
    </ShareArticle>
  );
}

function ItemCard({ it }: { it: Item }) {
  return (
    <article
      className={`rounded-2xl px-4 py-4 ${it.pick ? "bg-[#F2F7FF] ring-1 ring-brand/30" : "bg-bg"}`}
    >
      {it.pick && (
        <p className="mb-1 text-[12px] font-extrabold text-brand">
          결영이네가 고른 것
        </p>
      )}
      <p className="text-[16px] font-extrabold leading-snug text-ink">
        {it.name}
      </p>
      <p className="mt-0.5 text-[13px] text-cap">{it.spec}</p>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[17px] font-extrabold text-brand">{it.unit}</span>
        <span className="text-[13px] text-sub">{it.price}</span>
      </p>
      <p className="text-[12px] text-cap">{it.calc}</p>
      <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-[13px] leading-relaxed">
        <div className="flex gap-2">
          <dt className="w-[56px] shrink-0 font-bold text-cap">성분</dt>
          <dd className="min-w-0 text-sub">{it.ingr}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[14px] font-semibold leading-relaxed text-ink">
        → {it.note}
      </p>
      {it.url && (
        <a
          href={it.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="mt-3 flex w-full items-center justify-center rounded-btn bg-brand py-3 text-[15px] font-bold text-white active:bg-brand-dark"
        >
          쿠팡에서 지금 가격 보기
        </a>
      )}
    </article>
  );
}

function Point({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-bg p-4">
      <p className="text-[16px] font-extrabold text-ink">{title}</p>
      <p className="mt-1 text-[15px] leading-relaxed text-sub">{children}</p>
    </div>
  );
}
