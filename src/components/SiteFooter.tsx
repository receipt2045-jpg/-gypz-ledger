import { BIZ, CONTACT } from '../lib/business'

/**
 * 화면 맨 아래 사업자 정보·안내 (2026-10-06, 재개발뷰 참고).
 * 앱 출시·유료 판매 전에 필요한 표시 + "계산·정보는 참고 자료" 한 줄.
 * 약관 링크는 Link 대신 #/ 주소 — 라우터 밖(테스트·공개 화면)에서도 그려지게.
 * news: 뉴스 화면에서는 기사 저작권 안내를 더한다.
 */
export default function SiteFooter({ news = false }: { news?: boolean }) {
  return (
    <footer className="mt-8 border-t border-line px-1 pb-4 pt-5 text-[11.5px] leading-relaxed text-cap">
      <p className="text-[12.5px] font-bold text-sub">모아불리 가계부</p>
      <p className="mt-1.5">
        모아불리는 투자자문·금융상품 판매 업체가 아니에요. 화면의 계산과 정보는 참고 자료이고, 돈에
        관한 판단과 그 결과는 이용하는 분께 있어요.
        {news && ' 기사 제목·사진의 저작권은 각 언론사에 있어요.'}
      </p>
      <p className="mt-2">
        상호 {BIZ.name} · 대표 {BIZ.ceo} · 사업자등록번호 {BIZ.regNo}
        <br />
        통신판매업 신고 {BIZ.salesNo}
        <br />
        {BIZ.address}
        <br />
        문의{' '}
        <a href={`mailto:${CONTACT}`} className="underline underline-offset-2">
          {CONTACT}
        </a>
      </p>
      <p className="mt-2 flex gap-3 font-semibold text-sub">
        <a href="#/legal/terms">이용약관</a>
        <a href="#/legal/privacy">개인정보처리방침</a>
      </p>
    </footer>
  )
}
