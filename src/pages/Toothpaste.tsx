import type { ReactNode } from "react";
import { Download, ExternalLink } from "lucide-react";
import ShareArticle, {
  ShareHero,
  ShareSection,
} from "../components/ShareArticle";

/**
 * 무불소 아기치약 10종 비교 + 어린이집 양치 파우치 3종 (2026-11-21) — 로그인 없이 열리는 공개 페이지.
 * 원고: 구글 드라이브 육아템리뷰_01_어린이집치약/ 의 블로그용 원고·10종 비교표. 숫자·제품명은 원고 그대로.
 * 치약은 의약외품이라 구매 링크를 달지 않는다 — 쿠팡 파트너스 링크는 양치 파우치 3종에만.
 * 건강 정보(불소 기준 등)는 원고 문장 그대로만 쓴다.
 */

const PDF_URL =
  "https://drive.google.com/uc?id=1vozo9RKG0savgUfq7qnaTfCH1DtMWUbJ&export=download";

const DISCLOSURE =
  "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

interface Paste {
  name: string;
  spec: string;
  age: string;
  price: string;
  unit: string;
  bulk?: string;
  cap: string;
  form: string;
  surf: string;
  pres: string;
  line: string;
  img?: string;
  pick?: boolean;
}

// 10종 비교표(무불소_아기치약_10종_비교표.md) 그대로 — 기준일 2026.11.20
const PASTES: Paste[] = [
  {
    name: "벨레다 어린이 무불소 치약",
    spec: "50ml · 독일",
    age: "6개월~12세",
    price: "7,100원",
    unit: "10ml당 1,420원",
    cap: "돌려 여는 스크류",
    form: "실리카 겔 / 펜넬·스피아민트",
    surf: "없음 (전성분 9종에 계면활성제 없음)",
    pres: "페녹시에탄올·파라벤·벤조산염·사카린 없음",
    line: "전성분이 9종뿐인 가장 단순한 처방. 대신 스크류 캡이라 등원길엔 불편",
    img: "paste-weleda",
  },
  {
    name: "비앤비 베이비지 치약 2단계 겔",
    spec: "딸기향 40g · 국내",
    age: "6개월~4세",
    price: "3,150원",
    unit: "10g당 788원",
    cap: "원터치 플립",
    form: "투명 겔, 묽은 편 / 딸기향",
    surf: "폴록사머407·시메티콘만 (SLS·합성계면활성제 없음)",
    pres: "파라벤·보존제 없음 (자일리톨·카모마일)",
    line: "가격·캡은 좋은데 제형이 묽어 뚜껑 주변에 흘러내림",
    img: "paste-bnb",
  },
  {
    name: "닥터대디스 안심무불소 베이비치약",
    spec: "라즈베리 60g · 국내",
    age: "0~3세",
    price: "6,000원",
    unit: "10g당 1,000원",
    bulk: "3개 15,420원 → 857원",
    cap: "원터치 플립 + 항균 캡",
    form: "투명 겔, 점도 있음 / 천연 라즈베리향",
    surf: "무합성계면활성제 (개별 성분명 확인 필요)",
    pres: "파라벤·트리클로산·CMIT/MIT 무첨가(13無) / 전체 성분 확인 필요",
    line: "치과의사 34명 개발. 뚜껑 편하고 안 흐르는 점도 — 어린이집 정착템 1순위",
    img: "paste-drdaddys",
    pick: true,
  },
  {
    name: "몽디에스 라즈베리 베이비치약",
    spec: "100g × 2개(1+1) · 국내",
    age: "0세 이상 (0~4세 권장)",
    price: "12,580원 / 2개",
    unit: "10g당 629원",
    cap: "원터치 플립",
    form: "반투명 겔, 비교적 묽음 / 라즈베리향",
    surf: "소듐메틸코코일타우레이트 (코코넛 유래, SLS 없음)",
    pres: "전성분에 보존제 없음 (사카린 대신 스테비올배당체)",
    line: "100g 대용량에 전성분 전체 공개. 한 학기 넉넉",
  },
  {
    name: "궁중비책 베이비 마일드 치약",
    spec: "딸기향 80g · 국내",
    age: "4세 이하",
    price: "7,200원",
    unit: "10g당 900원",
    bulk: "3개 18,240원 → 760원",
    cap: "원터치 플립",
    form: "무색 투명 겔 / 딸기·복숭아향",
    surf: "무계면활성제 (무연마제)",
    pres: "제조사 표기 13성분에 보존제 없음 / 허가 첨가제에 소르빈산칼륨 기재 — 개별 확인 필요",
    line: "연마제까지 뺀 가장 순한 처방. 대신 세정력은 약한 편",
  },
  {
    name: "함소아 베베 치약",
    spec: "딸기향 60g · 국내",
    age: "6개월~3세",
    price: "5,000원",
    unit: "10g당 833원",
    bulk: "3개 12,000원 → 667원",
    cap: "원터치 플립",
    form: "제형 확인 필요 / 딸기향",
    surf: "라우로일아미도프로필디메틸글리신 (아미노산계, SLS 없음)",
    pres: "보존제 없음 / 향료·PEG-1500 함유",
    line: "전성분 공개 + 저렴. 향료와 PEG 표기는 감안할 부분",
  },
  {
    name: "예꼬맘 1단계 아기치약",
    spec: "60g + 15g · 국내",
    age: "6개월 이상",
    price: "3,900원",
    unit: "10g당 520원",
    cap: "원터치 플립",
    form: "투명 겔 / 라즈베리향",
    surf: "무함유 (설페이트계 불검출, KCL)",
    pres: "파라벤·페녹시에탄올 불검출(KCL 21항목) / 효소처리스테비아",
    line: "10g당 최저 단가. 전성분과 시험성적까지 공개",
  },
  {
    name: "그린핑거 마이키즈 치약 1단계",
    spec: "60g · 국내",
    age: "3세 미만 (첫 양치)",
    price: "4,250원",
    unit: "10g당 708원",
    cap: "원터치 플립",
    form: "제형 확인 필요 / 천연 블루베리향",
    surf: "무합성계면활성제 (개별 명칭 미공개)",
    pres: "확인 필요 (제조사 자체 무첨가 기준 190종)",
    line: "중성 pH(6.5~8), 핀란드산 자일리톨. 대기업 브랜드라 안심",
  },
  {
    name: "네네덴트 무불소 어린이 치약",
    spec: "50ml · 독일",
    age: "24개월~6세",
    price: "5,400원 / 2개",
    unit: "10ml당 540원",
    cap: "확인 필요 (사진상 구분 불가)",
    form: "흰색 페이스트 / 사과·바나나(멘톨 없음)",
    surf: "라우로일사르코시네이트나트륨 (아미노산계, SLS 없음)",
    pres: "무파라벤·무사카린·무색소 / 프로필렌글리콜·EDTA 함유",
    line: "멘톨이 없어 안 맵고, 가격도 착한 편",
  },
  {
    name: "투투스 베이비 치약",
    spec: "60g · 국내",
    age: "첫니 시기 (돌 전후)",
    price: "10,200원",
    unit: "10g당 1,700원",
    cap: "원터치 플립",
    form: "불투명·점성 있음 / 거의 무향",
    surf: "계면활성제 배제 표기 (개별 명칭 확인 필요)",
    pres: "트리클로산·파라벤 무첨가 표기 / 전체 성분 확인 필요",
    line: "서울대치과병원 공동개발·약국 유통. 가격대는 가장 높음",
  },
];

const OPENNESS: [string, string, string][] = [
  ["예꼬맘 1단계", "전성분 + KCL 시험성적", "납·수은·파라벤·페녹시에탄올·설페이트계 등 21항목 결과 공개"],
  ["네네덴트", "전성분 + 성분별 배합목적", "제조사 홈페이지에 역할까지 표기"],
  ["몽디에스", "전성분 전체", "「화장품법에 따라 표시해야 하는 모든 성분」 형태"],
  ["함소아", "전성분 전체", "유효성분·기타첨가제 구분 표기"],
  ["벨레다", "전성분 9종", "공식몰 표기"],
  ["비앤비", "전성분 전체", "제조사(케이엠제약) 홈페이지 공개"],
  ["궁중비책", "주요성분 13종", "허가 첨가제 목록과 일부 차이 — 개별 확인 필요"],
  ["닥터대디스", "주요 성분만", "자일리톨·하이드록시아파타이트·피로인산나트륨 등 / 전체 미공개"],
  ["투투스", "일부", "유효성분·항균 특허 중심 / 전체 미공개"],
  ["그린핑거", "일부", "무첨가 기준만 공개 / 개별 성분명 미공개"],
];

interface PouchItem {
  no: string;
  kind: string;
  name: string;
  price: string;
  priceNote?: string;
  review: string;
  body: ReactNode;
  img: string;
  url: string;
  cta: string;
}

// 블로그용 원고 「4. 어린이집 양치 파우치, 이 3개면 끝」 그대로 — 가격·후기 2026.11.21 새벽 기준
const POUCH: PouchItem[] = [
  {
    no: "①",
    kind: "아기 칫솔",
    name: "더트웰브 2단계 토들러 칫솔 12~36개월, 파스텔, 12개입",
    price: "23,800원",
    priceNote: "1개당 1,983원",
    review: "후기 8,350개 · 4.5점",
    body: (
      <>
        12~36개월 전용 사이즈예요. 12개입이면 파우치에
        여분 2~3개를 넣어두고 잃어버리거나 뭉개져도 그날 교체할 수 있어요.
      </>
    ),
    img: "pouch-toothbrush",
    url: "https://link.coupang.com/a/iP7Ny3ETw4",
    cta: "더트웰브 토들러 칫솔 보러 가기",
  },
  {
    no: "②",
    kind: "휴대용 양치컵",
    name: "KC인증 어린이 투명 양치컵 칫솔케이스 (핑크·화이트)",
    price: "8,400원",
    review: "후기 206개 · 4.5점 (최고 84%)",
    body: (
      <>
        뚜껑이 그대로 양치컵이 되는 2-in-1 제품입니다. 칫솔을 통 안에 넣고
        뚜껑을 컵으로 쓰면 되니까, 등원 가방에 칫솔과 컵을 따로 챙길 필요가
        없어요. KC 어린이제품 인증(공급자적합성확인)을 받았고, 통이 투명해서
        물기가 남았는지 한눈에 보입니다. 방수 파우치까지 같이 옵니다.
        <br />
        <br />
        후기를 보면 &ldquo;어린이집 양치컵으로 샀는데 컵 따로 안 챙겨도 돼서
        편하다&rdquo;는 이야기가 많고, 간혹 &ldquo;생각보다 커요&rdquo;라는 평도
        있습니다. 두 돌 아이가 혼자 들기에는 조금 큰 편이라 집에서 먼저 열고
        닫는 연습을 시키면 좋습니다.
      </>
    ),
    img: "pouch-cup",
    url: "https://link.coupang.com/a/iP80Ed467E",
    cta: "어린이 투명 양치컵 칫솔케이스 보러 가기",
  },
  {
    no: "③",
    kind: "휴대용 칫솔 살균기",
    name: "프리쉐 UV LED 휴대용 칫솔살균기 PA-TS700",
    price: "13,900원",
    priceNote: "정가 29,800원",
    review: "후기 11,369개 · 4.5점",
    body: (
      <>
        책처럼 접히는 슬림형이라 파우치에 눕혀 넣습니다. 자외선 살균 + USB
        충전식이고, 한 달에 600명 이상이 사가는 제품이에요. 금요일에 집에
        가져와 충전하고 월요일에 다시 넣는 식으로 쓰면 됩니다.
      </>
    ),
    img: "pouch-sterilizer",
    url: "https://link.coupang.com/a/iP7FPW2YWO",
    cta: "프리쉐 휴대용 칫솔살균기 보러 가기",
  },
];

export default function Toothpaste() {
  return (
    <ShareArticle
      kind="guide"
      toc={[
        { no: 1, title: "결론부터" },
        { no: 2, title: "무불소 아기치약 10종, 한 줄 정리" },
        { no: 3, title: "상황별로 고르기" },
        { no: 4, title: "사기 전에 알아둘 4가지" },
        { no: 5, title: "비교표 PDF로 받기" },
        { no: 6, title: "어린이집 양치 파우치, 이 3개면 끝" },
      ]}
      hero={
        <ShareHero
          kicker="결영이네 육아템 리뷰"
          title={
            <>
              무불소 아기치약
              <br />
              10종 비교
            </>
          }
          lead={
            <>
              어린이집에 보낼 치약을 고르다가,
              <br />
              <b className="font-bold text-[#FFD66B]">10종</b>을 성분·뚜껑·가격으로
              비교했습니다.
            </>
          }
        />
      }
      sources={
        <>
          <p className="font-semibold text-sub">자료 출처</p>
          <ul className="mt-1.5 space-y-1">
            <li>· 성분 — 각 제조사 공식몰, 식약처 의약외품 허가정보</li>
            <li>· 치약 가격 — 쿠팡·공식몰 최저가 (2026년 11월 20일 기준)</li>
            <li>
              · 양치 파우치 3종 가격·후기 — 쿠팡 상품 화면 (2026년 11월 21일
              새벽 기준)
            </li>
          </ul>
          <p className="mt-3">
            제품가는 표기 시점 기준이며 변동될 수 있습니다. {DISCLOSURE}
          </p>
        </>
      }
    >
      {/* ── 1. 결론 */}
      <ShareSection no={1} title="결론부터">
        <div className="rounded-2xl bg-[#F2F7FF] px-4 py-4">
          <p className="text-[17px] font-extrabold leading-snug text-ink">
            저희는 어린이집 치약을 무불소로 골랐어요.
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-sub">
            불소 치약은 집에서 아침·저녁에 쓰고, 낮에 선생님이 여러 아이를
            연속으로 닦이는 어린이집에는 뱉지 않아도 부담이 적은 무불소를
            보내기로 했어요.
          </p>
        </div>
        <div className="mt-3 space-y-2.5">
          <Point title="갈리는 건 성분보다 뚜껑과 점도">
            10종 중 8종이 원터치 캡이지만, 돌려 여는 스크류 캡은 바쁜 등원
            시간에 밀립니다. 겔이 너무 묽으면 뚜껑 주변에 흘러내려 관리가
            힘들어요.
          </Point>
          <Point title="10g당 520원~1,700원, 3배 넘게 차이">
            100g 대용량과 40~60g 제품을 10g당으로 환산해야 실제 부담이
            보입니다.
          </Point>
        </div>
      </ShareSection>

      {/* ── 2. 10종 */}
      <ShareSection no={2} title="무불소 아기치약 10종, 한 줄 정리">
        <p className="text-[14px] leading-relaxed text-sub">
          10g당 가격으로 맞춰 적었어요. 성분란의 &lsquo;확인 필요&rsquo;는
          제조사가 전성분을 공개하지 않아 확인할 수 없는 항목입니다(추측 기재
          없음).
        </p>
        <div className="mt-4 space-y-3">
          {PASTES.map((p) => (
            <PasteCard key={p.name} p={p} />
          ))}
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-cap">
          ※ 의약외품 치약은 화장품법상 전성분 표시 의무가 없어 브랜드마다 공개
          범위가 다릅니다.
        </p>
        <details className="mt-3 rounded-2xl bg-bg px-4 py-3">
          <summary className="cursor-pointer text-[15px] font-bold text-ink">
            브랜드별 전성분 공개 수준 보기
          </summary>
          <ul className="mt-3 divide-y divide-line">
            {OPENNESS.map(([name, scope, note]) => (
              <li key={name} className="py-2.5">
                <p className="text-[14px] font-bold text-ink">
                  {name}{" "}
                  <span className="ml-1 font-semibold text-brand">{scope}</span>
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-sub">
                  {note}
                </p>
              </li>
            ))}
          </ul>
        </details>
      </ShareSection>

      {/* ── 3. 상황별 */}
      <ShareSection no={3} title="상황별로 고르기">
        <div className="space-y-2.5">
          <Pick
            where="어린이집 등원"
            what="닥터대디스 · 몽디에스"
            why="원터치 캡 + 안 흐르는 점도. 선생님이 연속으로 닦이는 자리에서 흘림이 없어야 합니다."
            best
          />
          <Pick
            where="가격 우선"
            what="예꼬맘 · 네네덴트 · 비앤비"
            why="10g당 520~790원. 자주 사서 자주 버리는 어린이집용에 부담이 적습니다."
          />
          <Pick
            where="성분 최소"
            what="벨레다 · 궁중비책"
            why="벨레다는 전성분 9종, 궁중비책은 계면활성제·연마제까지 배제. 대신 캡·세정력은 아쉽습니다."
          />
          <Pick
            where="한 학기 넉넉히"
            what="몽디에스 100g"
            why="1+1에 12,580원, 전성분 전체 공개. 파우치에 한 통 넣어두면 학기 내내 갑니다."
          />
        </div>
      </ShareSection>

      {/* ── 4. 알아둘 것 */}
      <ShareSection no={4} title="사기 전에 알아둘 4가지">
        <div className="space-y-3">
          <Point title="무불소는 충치 예방 효과가 없습니다">
            무불소는 &lsquo;삼켜도 부담이 적은 치약&rsquo;이라는 뜻이에요.
            집에서 아침·저녁 불소 치약(만 3세 전 쌀알만큼, 3세 이후 완두콩만큼)을
            따로 챙기는 게 전제입니다.
          </Point>
          <Point title="가격은 2026년 11월 20일 기준">
            쿠팡·공식몰 최저가입니다. 로켓배송·기획전에 따라 10g당 단가가
            20~30% 흔들리니, 사기 직전 10g당으로 다시 계산해 보세요.
          </Point>
          <Point title="향과 멘톨을 확인하세요">
            예꼬맘 1단계에는 L-멘톨이 소량 들어 있어 살짝 시원한 편이고,
            네네덴트는 멘톨·페퍼민트오일을 넣지 않아 가장 순한 맛입니다. 민트를
            싫어하는 아이는 후자를 권합니다.
          </Point>
          <Point title="'확인 필요'는 비어 있는 정보입니다">
            제조사가 공개하지 않은 항목이라 임의로 채우지 않았습니다. 해당
            제품을 고르실 때는 고객센터에 전성분을 한 번 물어보는 게 가장
            확실합니다.
          </Point>
        </div>
      </ShareSection>

      {/* ── 5. PDF */}
      <ShareSection no={5} title="비교표 PDF로 받기">
        <p className="text-[15px] leading-relaxed text-sub">
          위 10종 비교표를 PDF로 받아 두고, 살 때 꺼내 보세요.
        </p>
        <a
          href={PDF_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-btn bg-brand py-4 text-[16px] font-bold text-white shadow-cta active:bg-brand-dark"
        >
          <Download size={19} />
          비교표 PDF 다운로드
        </a>
      </ShareSection>

      {/* ── 6. 양치 파우치 */}
      <ShareSection no={6} title="어린이집 양치 파우치, 이 3개면 끝">
        <p className="text-[15px] leading-relaxed text-sub">
          치약은 의약외품이라 쿠팡 파트너스 링크가 막혀 있습니다. 그래서
          파우치에 같이 들어가는 용품 3종을 골라 링크를 붙였습니다. 가격·후기는
          2026년 11월 21일 새벽 기준입니다.
        </p>
        <p className="mt-3 rounded-xl border border-[#FFD66B] bg-[#FFF8E1] px-4 py-3 text-[14px] font-semibold leading-relaxed text-ink">
          {DISCLOSURE}
        </p>
        <div className="mt-4 space-y-4">
          {POUCH.map((item) => (
            <PouchCard key={item.url} item={item} />
          ))}
        </div>

        <div className="mt-5 rounded-2xl bg-bg px-4 py-4">
          <p className="text-[16px] font-extrabold text-ink">
            파우치 구성, 이렇게 넣었습니다
          </p>
          <ul className="mt-2.5 space-y-2 text-[14px] leading-relaxed text-sub">
            <li>
              <b className="text-ink">매일 쓰는 것</b> · 칫솔 1자루(살균기에
              넣어) + 휴대용 양치컵 1개
            </li>
            <li>
              <b className="text-ink">파우치에 남겨두는 여분</b> · 칫솔 2~3자루
            </li>
            <li>
              <b className="text-ink">집에서 충전</b> · 살균기는 금요일에 가져와
              USB로 충전, 월요일에 다시 넣기
            </li>
            <li>
              <b className="text-ink">금요일 귀가</b> · 양치컵은 뚜껑을 열어
              물기를 말린 뒤 케이스에 넣기
            </li>
          </ul>
        </div>
        <div className="mt-3 rounded-2xl bg-ink px-5 py-4 text-white">
          <p className="text-[18px] font-extrabold leading-snug">
            3종 합계 46,100원
          </p>
          <p className="mt-1 text-[14px] text-white/75">
            칫솔 23,800 + 양치컵 8,400 + 살균기 13,900
          </p>
        </div>
      </ShareSection>
    </ShareArticle>
  );
}

function PasteCard({ p }: { p: Paste }) {
  return (
    <article
      className={`rounded-2xl px-4 py-4 ${p.pick ? "bg-[#F2F7FF] ring-1 ring-brand/30" : "bg-bg"}`}
    >
      <div className="flex gap-3">
        {p.img && (
          <img
            src={`/share/toothpaste/${p.img}.webp`}
            alt=""
            loading="lazy"
            className="h-24 w-12 shrink-0 object-contain"
          />
        )}
        <div className="min-w-0 flex-1">
          {p.pick && (
            <p className="mb-1 text-[12px] font-extrabold text-brand">
              어린이집 정착템 1순위
            </p>
          )}
          <p className="text-[16px] font-extrabold leading-snug text-ink">
            {p.name}
          </p>
          <p className="mt-0.5 text-[13px] text-cap">
            {p.spec} · {p.age}
          </p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
            <span className="text-[17px] font-extrabold text-brand">
              {p.unit}
            </span>
            <span className="text-[13px] text-sub">{p.price}</span>
          </p>
          {p.bulk && <p className="text-[13px] text-sub">{p.bulk}</p>}
        </div>
      </div>
      <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-[13px] leading-relaxed">
        <Row k="뚜껑" v={p.cap} />
        <Row k="제형·향" v={p.form} />
        <Row k="계면활성제" v={p.surf} />
        <Row k="보존제·주의" v={p.pres} />
      </dl>
      <p className="mt-3 text-[14px] font-semibold leading-relaxed text-ink">
        → {p.line}
      </p>
    </article>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[68px] shrink-0 font-bold text-cap">{k}</dt>
      <dd className="min-w-0 text-sub">{v}</dd>
    </div>
  );
}

function PouchCard({ item }: { item: PouchItem }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white">
      <img
        src={`/share/toothpaste/${item.img}.webp`}
        alt={item.name}
        loading="lazy"
        className="mx-auto aspect-square w-full max-w-[320px] object-contain"
      />
      <div className="px-4 pb-4">
        <p className="text-[13px] font-bold text-brand">
          {item.no} {item.kind}
        </p>
        <p className="mt-1 text-[16px] font-extrabold leading-snug text-ink">
          {item.name}
        </p>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
          <span className="text-[18px] font-extrabold text-ink">
            {item.price}
          </span>
          {item.priceNote && (
            <span className="text-[13px] text-sub">({item.priceNote})</span>
          )}
        </p>
        <p className="text-[13px] text-cap">{item.review}</p>
        <p className="mt-2.5 text-[14px] leading-relaxed text-sub">
          {item.body}
        </p>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-btn bg-[#E52528] py-3.5 text-[15px] font-bold text-white active:opacity-90"
        >
          {item.cta}
          <ExternalLink size={16} />
        </a>
      </div>
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

function Pick({
  where,
  what,
  why,
  best = false,
}: {
  where: string;
  what: string;
  why: string;
  best?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-3.5 ${best ? "bg-[#F2F7FF]" : "bg-bg"}`}
    >
      <p className="text-[13px] font-bold text-sub">{where}</p>
      <p
        className={`mt-0.5 text-[17px] font-extrabold ${best ? "text-brand" : "text-ink"}`}
      >
        {what}
      </p>
      <p className="mt-1 text-[14px] leading-relaxed text-sub">{why}</p>
    </div>
  );
}
