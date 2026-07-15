# 우리집 가계부 (GYPZ)

맞벌이 부부를 위한 가계부 + 자산관리 웹앱 프로토타입.
한 달에 한 번, 5분이면 끝나는 **월말 정산 마법사**로 가계부를 채우는 초간편 UX를 목표로 합니다.
디자인은 토스(Toss) 스타일.

## 기술 스택

- **Vite + React 18 + TypeScript** (strict)
- **Tailwind CSS v3** — 토스 컬러 시스템
- **Recharts** — 순자산 추이 / 저축·투자율 차트
- **zustand + persist** — localStorage 저장 (key: `gypz-ledger-v1`)
- **react-router-dom** — 라우팅
- **lucide-react** — 아이콘
- **Pretendard** (CDN) — 폰트

## 실행 방법

```bash
npm install      # 의존성 설치
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 프로덕션 빌드 (tsc + vite)
npm run preview  # 빌드 결과 미리보기
```

## 화면 구성

| 경로         | 화면           | 설명                                                         |
| ------------ | -------------- | ------------------------------------------------------------ |
| `/`          | 홈 대시보드    | 이번 달 순자산, 요약, 잉여현금, 순자산 추이, 10년 목표, 정산 CTA |
| `/checkup`   | 월말 정산 마법사 | 수입→저축·투자→고정→변동→자산→완료 6단계 위저드 (자동 이월)   |
| `/monthly`   | 월간 가계부    | 월 선택 · 부부 토글 · 섹션별 예산/결산/차이 · 잉여현금        |
| `/assets`    | 자산           | 순자산 · 전월 대비 · 추이 차트 · 그룹별 자산/부채 · 10년 목표 |
| `/yearly`    | 연간 리포트    | 카테고리×12개월 결산 매트릭스 · 월별 저축·투자율 · 경조사 기록 |
| `/settings`  | 설정           | 부부 이름 · 목표 순자산 · 카테고리 관리 · JSON 내보내기/가져오기 · 초기화 |

## 핵심 로직

- **자동 이월** (`src/lib/carryover.ts`): 데이터가 없는 달은 직전 달 항목을 복사.
  고정 성격(수입/저축/투자/고정지출)은 지난달 값을 그대로 이월, 변동지출은 예산만 이월하고 실제값은 0으로 초기화.
- **정산 마법사**: 각 단계에서 "지난달과 같아요" 원탭으로 넘어가고, 변동지출·자산만 실제 입력.
  완료 시 해당 월을 `closed=true`로 저장하고 자산 스냅샷을 갱신.
- **시드 데이터** (`src/seed.ts`): 2026년 2월~7월 6개월치 예시 데이터. 7월은 아직 정산 전(`closed=false`).

## 프로젝트 구조

```
src/
  components/   Card, AmountInput, ProgressBar, TabBar, AppFrame, SectionList, StepProgress
  pages/        Home, Checkup, Monthly, Assets, Yearly, Settings
  lib/          format.ts(금액 포맷/축약) · carryover.ts(이월/집계) · store.ts(zustand) · constants.ts
  types.ts      데이터 모델
  seed.ts       시드 데이터
```

> 저장 데이터는 브라우저 localStorage에만 보관됩니다. 설정 화면에서 JSON으로 백업/복원할 수 있습니다.
