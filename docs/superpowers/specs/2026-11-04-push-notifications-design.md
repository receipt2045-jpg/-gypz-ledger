# 2단계: 푸시 알림 — 설계

작성 2026-11-04 · 승인: 결영(대화에서 항목별 "ㅇㅇ", 마지막 "알아서 해줘")
앞 단계: `2026-10-31-hybrid-android-shell-design.md` (Capacitor 하이브리드 앱, moabuli.com 원격 로드)

## 목표 / 성공 기준

1. 안드로이드 앱(moabuli.app 1.2.0, versionCode 3)이 푸시 알림을 받는다. 웹에는 알림이 없다.
2. 알림 네 가지 + 공지가 아래 규칙대로 정확히 한 번씩 간다.
3. 사람마다 종류별 스위치(리마인더는 시각 포함)로 켜고 끈다.
4. 홍보(광고) 알림은 정보통신망법 제50조를 지킨다: 사전 동의, "(광고)" 표기, 수신 거부 방법 안내, 21~08시 금지, 동의·철회 처리 결과 안내, 2년마다 동의 재확인.
5. 결영이 관리자 화면에서 공지·홍보 알림을 쓰고 지금 보내거나 예약한다.

## 이번에 안 하는 것

- 아이폰 알림(3단계), 알림 열람 통계, 사용자별 맞춤 문구, 이메일·문자 알림.

## 구조

```
앱(Capacitor) ── 토큰 등록 ──▶ Supabase DB (push_tokens)
                                   │ pg_cron 5분마다 → Edge Function push-dispatch
                                   ▼
                     FCM HTTP v1 (Firebase 서비스 계정) ──▶ 폰
```

- **앱**: `@capacitor/push-notifications`. 로그인 상태에서 권한이 허용돼 있으면 토큰을 받아 `push_tokens`에 upsert. 알림 탭(`pushNotificationActionPerformed`)의 `data.path`로 해시 라우트 이동. Firebase 설정 파일 `android/app/google-services.json`(공개 설정값, 레포에 포함).
- **서버**: Edge Function `push-dispatch` 하나가 5분마다 돌며 "지금 보낼 것"을 고르고 보낸다. pg_cron + pg_net이 비밀 헤더(`PUSH_CRON_SECRET`)를 붙여 호출(Verify JWT 끔, 헤더 검사).
- **규칙은 순수 함수로 분리**: `supabase/functions/_shared/pushRules.ts` — 입력(지금 시각, 사용자 설정, 기록 여부, 정산 여부, 오늘 글, 보낸 기록) → 출력(보낼 목록). DB·FCM 없이 vitest로 테스트한다.
- **FCM 발송**: `supabase/functions/_shared/fcm.ts` — 서비스 계정 JSON(시크릿 `FIREBASE_SERVICE_ACCOUNT`)으로 OAuth 토큰을 만들어 v1 API 호출. `UNREGISTERED`/`INVALID_ARGUMENT` 응답 토큰은 `push_tokens`에서 지운다.
- **웹 코드 분기**: 모든 푸시 코드는 `isNative()`일 때만 실행(1단계 `src/lib/native.ts`). 웹 동작은 바뀌지 않는다(설정 화면에 안내 한 줄만 추가).

## 데이터 (새 테이블, RLS: 본인 행만 읽기·쓰기, 발송은 service_role)

| 테이블 | 열 |
|---|---|
| `push_tokens` | `token` (pk), `user_id`, `platform`('android'), `updated_at` |
| `notification_prefs` | `user_id` (pk), `reminder_on` (기본 true), `reminder_time` (time, 기본 21:00), `settle_on` (true), `news_on` (true), `promo_on` (false), `promo_consent_at` (timestamptz null), `promo_reconfirm_sent_at` (null), `updated_at` |
| `push_log` | `user_id`, `kind`, `ref_key`, `sent_at` — unique(`user_id`,`kind`,`ref_key`). 중복 방지와 "3일 뒤 다시" 판단용 |
| `push_campaigns` | `id`, `kind`('notice'\|'promo'), `title`, `body`, `path`, `send_at`, `status`('scheduled'\|'sent'\|'canceled'), `sent_count`, `fail_count`, `created_at` — 운영자만 쓰기 |

`notification_prefs` 행이 없는 사용자 = 아직 알림을 켜지 않은 사람(토큰도 없음). 처음 안내에서 [알림 받기] → 권한 허용 시 기본값 행 생성.

## 보내는 규칙 (모두 한국 시간)

| kind | 언제 | 조건 | ref_key | 문구(초안, 결영 말투) | path |
|---|---|---|---|---|---|
| `reminder` | `reminder_time` ~ +5분 창 | `reminder_on`, 오늘(KST) 본인 `member_no`의 `confessions`가 없음 | `YYYY-MM-DD` | 제목 "오늘 기록할 시간이에요" / 본문 "쓴 돈 30초면 남겨요." | `/confess` |
| `settle` | 정산일 20:00 창 | `settle_on`, 정산 대상 달 `ledgers.closed = false` | `ym:settle` | "이번 달 정산할 날이에요" / "한 달 돈 흐름, 같이 맞춰봐요." | `/monthly` |
| `settle_again` | 정산일+3일 20:00 창 | 위와 같음 + `push_log`에 `ym:settle`이 있음 | `ym:again` | "정산이 아직이에요" / "5분이면 끝나요." | `/monthly` |
| `news` | 08:00 창 | `news_on`, 오늘 `post_date`의 `news`/`market` 글이 있음 | `YYYY-MM-DD` | 제목 "오늘의 경제" / 본문 = 그 글 제목 | `/info/:id` |
| `notice` | 캠페인 `send_at` 이후 첫 실행 | `news_on` | `campaign:id` | 운영자 입력 | 운영자 선택 |
| `promo` | 캠페인 `send_at` 이후 첫 실행, 단 08:00~20:59에만 | `promo_on` | `campaign:id` | "(광고) " + 제목 / 본문 + "\n수신 거부: 설정 > 알림" | 운영자 선택 |
| `promo_reconfirm` | 기준일 + 23개월이 지난 뒤 첫 실행(08:00~20:59). 기준일 = `max(promo_consent_at, promo_reconfirm_sent_at)` | `promo_on`. 보낸 뒤 `promo_reconfirm_sent_at = now` (그래서 2년마다 반복) | `reconfirm:YYYY-MM` | "소식·혜택 알림, 계속 받으시겠어요?" / "○○년 ○월 ○일에 동의하셨어요. 그만 받으려면 설정 > 알림에서 꺼 주세요." | `/settings` |

- **정산일**: 집의 `households.month_start_day`(d)인 날. 그날 정산 대상 달 = `shiftYm(그날의 ym, -1)` (`src/lib/format.ts`의 `ymOfDate` 규칙과 같다: d일이 되면 새 달이 시작되고, 끝난 달이 정산 대상).
- **5분 창**: 실행 시각 `now`에 대해 목표 시각 `t`가 `now-5분 < t ≤ now`이면 보낸다. 서버가 한 번 건너뛰어도 `push_log` unique로 중복은 막히지만, 창을 놓친 알림은 보내지 않는다(늦은 알림보다 안 보내는 게 낫다). 단 캠페인(`notice`/`promo`)은 `send_at` 이후 첫 실행에서 보낸다.
- **부부**: 정산 알림은 그 집 구성원 모두에게, 리마인더는 각자 기록 여부로 따로.
- **여러 폰**: 한 사람의 토큰이 여러 개면 모두에게 보낸다(로그는 사람 기준 1건).
- **광고 시간 막기**: 예약 화면에서 21~08시 선택 불가 + 발송 직전 다시 검사(시간 밖이면 다음 08:00으로 미룬다).

## 화면

### 처음 안내 (앱에서만, 로그인 후 홈에서 한 번)
- 바텀시트: "놓치지 않게 알려드릴게요" + 세 줄(기록할 시간 밤 9시 / 정산하는 날 / 오늘의 경제 아침 8시) + 체크박스 "결영이네 소식·혜택 알림 받기 (선택, 광고)"(기본 해제) + [알림 받기] [나중에].
- [알림 받기] → OS 권한 요청 → 허용 시 기본값 저장(체크했으면 `promo_on=true`, `promo_consent_at=now`, "○월 ○일 소식·혜택 알림 수신에 동의하셨어요" 토스트) → 토큰 등록.
- 거부 또는 [나중에] → 7일간 다시 안 띄움(localStorage `pushAskedAt`). 설정에서 언제든 켤 수 있다.

### 설정 > 알림
- 기록 리마인더 [스위치] + 시각(30분 단위 선택, 기본 21:00) / 월말 정산 [스위치] / 오늘의 경제·공지 [스위치] / 결영이네 소식·혜택 (광고) [스위치].
- 광고 스위치 변경 시 즉시 "○○년 ○월 ○일 수신 동의(거부)가 처리됐어요" 안내(처리 결과 통지).
- OS 알림 권한이 꺼져 있으면 "폰 설정에서 알림이 꺼져 있어요 [설정 열기]".
- 웹: "알림은 모아불리 앱에서 받을 수 있어요" 한 줄.

### 관리자 > 알림 보내기 (`/admin/posts`에 탭 추가, 운영자 계정만)
- 종류(공지/홍보), 제목, 내용, 열릴 화면(오늘의 경제·상담 신청·특정 글·홈 등 목록), [지금 보내기] / [예약 날짜·시각].
- 홍보: 미리보기에 "(광고)"·수신 거부 문구가 붙어 보이고, 21~08시 예약 불가.
- 보내기 전 "○명에게 보내요" 확인(대상 수는 서버 함수로 계산).
- 목록: 예약·보냄·취소 상태, 보낸 수·실패 수, 예약 취소 버튼.

## 법·개인정보

- 개인정보처리방침(`src/pages/Legal.tsx`와 `public/privacy.html` 함께): 수집 항목에 "알림 수신용 기기 식별값(푸시 토큰)·알림 설정", 처리 위탁·국외 이전에 "Google LLC (Firebase Cloud Messaging, 미국) — 푸시 알림 발송", 광고성 알림 수신 동의·철회 방법. 시행일 갱신.
- 플레이 콘솔 데이터 보안: 기기 또는 기타 ID(앱 기능·광고/마케팅 목적의 알림) 추가 — 1.1.0 프로덕션 때의 마이크 항목과 함께 처리.
- AndroidManifest: `POST_NOTIFICATIONS` 권한(안드로이드 13+), 알림 아이콘(모아불리 단색 아이콘)·기본 채널 "모아불리 알림".
- 시크릿(`FIREBASE_SERVICE_ACCOUNT`, `PUSH_CRON_SECRET`)은 Supabase Secrets에만. 레포·대화에 값 출력 금지.

## 오류 처리

- FCM 실패: 토큰 무효면 삭제, 그 외(일시 오류)는 로그에 실패로 남기고 다음 실행에서 재시도하지 않는다(중복 위험보다 누락이 낫다). 캠페인은 `fail_count` 집계.
- `push-dispatch` 한 번의 실행에서 한 종류가 실패해도 다른 종류는 계속 보낸다(종류별 try).
- 앱: 권한 거부·토큰 발급 실패는 조용히 넘어가고 설정 화면에 상태로만 보인다.

## 테스트

- `pushRules` 단위 테스트: 각 kind의 시각 창 경계, 리마인더 기록 있음/없음, 정산일 계산(시작일 1·25, 월말), 정산 완료 시 안 보냄, 3일 뒤 다시(첫 알림 없었으면 안 보냄), 오늘 글 없음, 광고 시간 밖 미룸, 재확인 23개월, 중복 방지.
- 앱 쪽: 토큰 등록·알림 탭 이동·처음 안내 표시 조건을 mock으로 테스트. 웹(`isNative()` false)에서 아무것도 안 하는지.
- 관리자 화면: 광고 미리보기 문구, 21~08시 예약 막기 화면 테스트.
- 폰(내부 테스트 1.2.0): 공지 즉시 발송 수신, 리마인더 시각을 2분 뒤로 맞춰 수신, 기록 후엔 안 옴, 알림 탭 시 해당 화면 열림, 광고 21시 이후 예약 불가.

## 출시

1. 결영과 크롬에서 Firebase 프로젝트 생성(기존 GCP 프로젝트 `striped-century-502904-r5`에 Firebase 추가), 안드로이드 앱 `moabuli.app` 등록 → `google-services.json`, 서비스 계정 키 → Supabase 시크릿(값은 셸로 직접, 출력 금지).
2. DB SQL 실행(새 테이블·RLS·pg_cron), Edge Function 배포, 웹 배포.
3. `npm run android:release`로 1.2.0(vc3) AAB → 내부 테스트 → 폰 확인.
4. 프로덕션: 1.0.0 승인 → 1.1.0(또는 1.1.0 대신 1.2.0) 제출 — 결영 확인 후.
