import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

const SERVICE = '모아불리'
const CONTACT = 'receipt2045@gmail.com'
const UPDATED = '2026-07-19'

/**
 * 개인정보처리방침 / 이용약관 (출시 필수)
 * /legal/privacy · /legal/terms
 */
export default function Legal() {
  const navigate = useNavigate()
  const { doc } = useParams<{ doc: string }>()
  const isPrivacy = doc !== 'terms'

  return (
    <div className="flex min-h-screen justify-center bg-[#e6e9ed]">
      <div className="relative flex min-h-screen w-full max-w-app flex-col bg-bg px-6 pb-16 shadow-[0_0_60px_rgba(0,0,0,0.06)]">
        <div className="sticky top-0 z-10 -mx-6 bg-bg px-6 pb-3 pt-4">
          <button onClick={() => navigate(-1)} className="mb-2 text-ink active:opacity-60" aria-label="뒤로">
            <ChevronLeft size={26} />
          </button>
          <h1 className="text-[22px] font-extrabold text-ink">
            {isPrivacy ? '개인정보처리방침' : '이용약관'}
          </h1>
          <p className="mt-1 text-[12px] text-cap">시행일 {UPDATED}</p>
        </div>
        <div className="prose-legal space-y-4 pt-2 text-[13px] leading-relaxed text-sub">
          {isPrivacy ? <Privacy /> : <Terms />}
        </div>
      </div>
    </div>
  )
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-3 text-[15px] font-bold text-ink">{children}</h2>
}

function Privacy() {
  return (
    <>
      <p>
        {SERVICE}(이하 "서비스")은 이용자의 개인정보를 중요하게 여기며, 「개인정보 보호법」 등 관련
        법령을 준수합니다. 본 방침은 서비스가 어떤 정보를 어떻게 수집·이용·보관하는지 설명합니다.
      </p>

      <H>1. 수집하는 개인정보 항목</H>
      <p>
        · 필수: 이메일 주소(회원 식별·로그인), 비밀번호(암호화 저장) 또는 구글 계정 식별정보
        <br />· 이용자가 직접 입력: 가계부 데이터(수입·지출·저축·투자·자산·부채·정산·일일 고백 기록),
        구성원 호칭, 목표 금액
        <br />· 자동 생성: 접속·오류 로그(서비스 운영·보안 목적)
      </p>
      <p>
        서비스는 은행·카드사 계좌를 연결하지 않으며, 이용자가 직접 입력한 정보만 처리합니다.
      </p>

      <H>2. 수집·이용 목적</H>
      <p>
        회원 식별 및 로그인 유지, 가계부·자산 관리 기능 제공, 부부 간 데이터 공유(초대 코드로 연결된
        구성원에 한함), 선택 기능인 AI 코칭 진단 제공, 서비스 개선·오류 대응.
      </p>

      <H>3. 보유 및 파기</H>
      <p>
        개인정보는 회원 탈퇴 시 지체 없이 파기합니다. 이용자는 언제든 설정 화면에서 회원 탈퇴를 통해
        본인 계정과 관련 데이터의 삭제를 요청할 수 있습니다. 관련 법령상 보관 의무가 있는 경우 해당
        기간 동안만 보관 후 파기합니다.
      </p>

      <H>4. 처리 위탁 및 국외 이전</H>
      <p>
        서비스는 안정적인 운영을 위해 아래 업체에 개인정보 처리를 위탁하며, 데이터가 국외 서버에
        저장·처리됩니다. 이용자는 회원가입·서비스 이용으로 이에 동의한 것으로 봅니다.
      </p>
      <p>
        · <b>Supabase, Inc.</b> (미국) — 데이터베이스·인증(계정·가계부 데이터 저장). 이전 시점: 서비스
        이용 시. 이전 항목: 위 1항의 정보.
        <br />· <b>Anthropic, PBC</b> (미국) — AI 코칭 진단 기능을 이용할 때에 한해, 개인 식별정보를
        제외한 익명 집계(카테고리별 금액)만 전송됩니다. 이름·계좌·이메일은 전송하지 않습니다.
        <br />· 호스팅: GitHub Pages(미국).
      </p>

      <H>5. 이용자의 권리</H>
      <p>
        이용자는 자신의 개인정보에 대해 열람·정정·삭제·처리정지를 요구할 수 있으며, 설정 화면에서 직접
        데이터 내보내기(JSON) 및 회원 탈퇴가 가능합니다. 기타 요청은 아래 연락처로 문의해 주세요.
      </p>

      <H>6. 안전성 확보 조치</H>
      <p>
        비밀번호는 복호화 불가능한 방식으로 저장되며, 모든 통신은 HTTPS로 암호화됩니다. 데이터는
        가구(부부) 단위 접근 제어(RLS)로 분리되어, 연결되지 않은 타인은 접근할 수 없습니다.
      </p>

      <H>7. 개인정보 보호책임자</H>
      <p>
        문의: <a className="text-brand" href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>

      <H>8. 고지</H>
      <p>본 방침은 관련 법령·서비스 변경에 따라 개정될 수 있으며, 변경 시 앱 내 공지합니다.</p>
    </>
  )
}

function Terms() {
  return (
    <>
      <H>제1조 (목적)</H>
      <p>
        본 약관은 {SERVICE}(이하 "서비스")의 이용 조건과 이용자·운영자의 권리·의무를 규정합니다.
      </p>

      <H>제2조 (서비스 내용)</H>
      <p>
        서비스는 부부가 함께 순자산을 관리하는 가계부 도구로, 월간 정산·예산·자산 기록, 일일 지출 기록
        및 캐릭터 반응, 선택적 AI 코칭 진단 등을 제공합니다. 무료로 제공되며, 기능은 사전 고지 후
        변경·중단될 수 있습니다.
      </p>

      <H>제3조 (계정)</H>
      <p>
        이용자는 이메일·비밀번호 또는 구글 계정으로 가입합니다. 계정·비밀번호 관리 책임은 이용자에게
        있으며, 부부 연결은 초대 코드를 통해 이루어집니다.
      </p>

      <H>제4조 (이용자의 의무)</H>
      <p>
        이용자는 타인의 정보를 도용하거나 서비스를 부정하게 이용해서는 안 됩니다. 입력한 데이터의
        정확성에 대한 책임은 이용자에게 있습니다.
      </p>

      <H>제5조 (면책 및 정보의 성격)</H>
      <p>
        서비스가 제공하는 요약·진단·잔소리 등 모든 정보는 <b>일반적인 참고 정보이며, 투자·세무·재무
        자문이 아닙니다.</b> 서비스는 이용자가 입력한 데이터에 기반한 계산·표시만 제공하며, 이를 근거로
        한 의사결정의 결과에 대해 책임지지 않습니다. 서비스는 자동 은행 연동을 하지 않습니다.
      </p>

      <H>제6조 (데이터·탈퇴)</H>
      <p>
        이용자는 설정 화면에서 데이터를 내보내거나 회원 탈퇴를 할 수 있으며, 탈퇴 시 관련 데이터는
        파기됩니다. 개인정보 처리에 관한 사항은 개인정보처리방침을 따릅니다.
      </p>

      <H>제7조 (책임의 한계)</H>
      <p>
        서비스는 천재지변, 제3자 서비스(호스팅·인증·AI) 장애 등 운영자의 통제를 벗어난 사유로 인한
        손해에 대해 책임을 지지 않습니다. 무료 서비스 특성상 데이터 백업 책임은 이용자에게 있으며,
        정기적 내보내기를 권장합니다.
      </p>

      <H>제8조 (문의)</H>
      <p>
        <a className="text-brand" href={`mailto:${CONTACT}`}>{CONTACT}</a>
      </p>
    </>
  )
}
