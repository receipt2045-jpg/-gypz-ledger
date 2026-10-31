# 1단계: 안드로이드 앱을 하이브리드(Capacitor)로 교체 — 설계

작성 2026-10-31 · 승인: 결영(대화에서 "ㅇㅇ")

## 왜

푸시 알림(2단계)과 아이폰 앱(3단계)을 하려면 앱 안에 우리 코드가 들어가야 한다.
지금 앱은 TWA(크롬이 moabuli.com을 통째로 보여줌)라 앱 쪽에 코드를 넣을 자리가 없다.
애플은 사이트만 감싼 앱을 반려하는 일이 많아(심사 지침 4.2), 아이폰 앱도 결국 하이브리드여야 한다.

전체 순서: **1단계 하이브리드 전환(안드로이드)** → 2단계 푸시 알림 → 3단계 아이폰 앱.
이 문서는 1단계만 다룬다.

## 목표 / 성공 기준

1. 플레이 스토어의 기존 앱(moabuli.app)이 **업데이트**로 하이브리드 앱이 된다 (같은 패키지명·같은 업로드 키).
2. 화면과 기능은 지금 웹과 똑같다. 사이트를 배포하면 앱 화면도 바로 바뀐다.
3. 이메일·비밀번호 로그인, **구글 로그인(앱 전용 방식)**, 로그아웃이 앱에서 된다.
4. 가입 확인·비밀번호 재설정 메일 링크(moabuli.com)를 누르면 앱이 열린다.
5. 외부 링크(원팀프로젝트, 상담 신청서, 카톡 등)는 앱 밖 브라우저로 열린다.
6. 폰 뒤로가기: 앱 안 이전 화면 → 첫 화면이면 앱 종료.
7. 인터넷이 끊기면 안내 화면이 나온다(지금 offline.html과 같은 문구).

## 이번에 안 하는 것

- 푸시 알림(2단계), 아이폰·애플 로그인(3단계)
- 화면 디자인·기능 변경
- 웹(브라우저) 사용자 쪽 변화 — 웹은 지금과 완전히 같다

## 구조

```
gypz-ledger/
  capacitor.config.ts      앱 이름·패키지명·불러올 주소
  android/                 Capacitor가 만드는 안드로이드 프로젝트 (레포에 포함, 서명 키는 레포 밖)
  src/lib/native.ts        "지금 앱 안인가?"와 폰 기능 호출을 한 곳에 모은 파일
```

- **Capacitor 8** (`@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/browser`).
- 앱은 `server.url = https://moabuli.com` 을 불러온다. 화면 파일을 앱에 넣지 않으므로 사이트 배포 = 앱 화면 업데이트.
  - 앱 안에서 Capacitor 브리지(폰 기능 호출 통로)는 moabuli.com 페이지에 주입된다.
  - 웹 코드는 `Capacitor.isNativePlatform()`으로 앱/웹을 가르고, 웹일 때는 지금 코드를 그대로 탄다.
- 패키지명 `moabuli.app`, 버전 1.1.0 (versionCode 2), 업로드 키는 `가계부/android-signing/moabuli-upload.jks` 그대로.
- 기존 TWA 프로젝트(`%USERPROFILE%\android-build\moabuli-android`)는 쓰지 않고 남겨 둔다(되돌리기용).

## 로그인

- 이메일·비밀번호: 변경 없음.
- 구글:
  - 웹 → 지금처럼 `signInWithOAuth` (리디렉션).
  - 앱 → `@capgo/capacitor-social-login` 으로 폰의 구글 계정 선택 창 → ID 토큰 → `supabase.auth.signInWithIdToken({ provider: 'google', token })`.
  - 필요한 것: Google Cloud 콘솔의 OAuth 클라이언트 — 웹 클라이언트 ID(Supabase에 이미 있는 것 재사용 가능 여부 확인)와 Android 클라이언트(패키지 moabuli.app + 플레이 앱 서명 키·업로드 키 SHA-1). 콘솔 작업은 결영 계정으로 크롬에서 같이 한다.
  - 마케팅 수신 선택(`stashMarketingChoice`)은 리디렉션이 없으니 바로 적용한다.

## 링크

- **앱으로 여는 링크(App Links)**: AndroidManifest에 `https://moabuli.com` intent-filter(autoVerify). 확인 파일은 이미 있는 `/.well-known/assetlinks.json` (moabuli.app, 플레이 서명 키 + 업로드 키) 재사용.
  - 메일 링크로 앱이 열리면 `@capacitor/app`의 `appUrlOpen`에서 받은 주소로 웹뷰를 이동시켜 Supabase가 세션을 처리하게 한다.
- **외부 링크**: moabuli.com·Supabase·구글 로그인 도메인이 아닌 주소는 `@capacitor/browser`(크롬 커스텀 탭) 또는 시스템 브라우저로 연다. `target="_blank"`와 `window.open`, 그리고 앱 밖 도메인으로의 이동을 모두 잡는다.
- `?src=app` 유입 표시는 앱 시작 주소에 그대로 붙인다(기존 집계 유지).

## 뒤로가기 · 오프라인

- `@capacitor/app` `backButton`: `canGoBack`이면 `history.back()`, 아니면 `App.exitApp()`.
- 오프라인: 앱에 `offline.html` 사본을 넣고, 첫 로드 실패 시 그 화면을 띄운다(`server.errorPath`).

## 출시

1. 로컬 빌드 → 서명된 APK를 결영 갤럭시에 설치(내부 테스트 트랙 또는 직접 설치)해 체크리스트 확인:
   이메일 로그인 / 구글 로그인 / 로그아웃 / 가입 확인 메일 링크 / 비밀번호 재설정 링크 / 원팀·상담·카톡 외부 링크 / 뒤로가기 / 비행기 모드 안내 화면 / 화면 위아래가 잘리지 않는지(상태바·내비게이션바).
2. 이상 없으면 AAB(1.1.0)를 프로덕션에 올리고 심사 제출 — 결영 확인 후.
3. 지금 심사 중인 1.0.0(TWA)이 승인된 뒤에 올린다.

## 위험과 대응

| 위험 | 대응 |
|---|---|
| Capacitor는 `server.url`을 주로 개발용으로 안내 | 안드로이드 심사엔 문제 없음. 3단계(아이폰) 때 화면 파일을 앱에 넣는 방식으로 바꿀지 다시 판단 |
| 구글 로그인 키 설정 실수로 "개발자 오류" | SHA-1 두 개(플레이 서명·업로드) 모두 등록, 내부 테스트에서 먼저 확인 |
| 업데이트 후 기존 사용자 로그인 풀림 | TWA는 크롬 저장소, 새 앱은 앱 웹뷰 저장소라 **한 번 다시 로그인해야 함** — 업데이트 안내 문구(출시 노트)에 적는다 |
| 메일 링크가 앱 대신 브라우저로 열림 | assetlinks 확인, 안 되면 브라우저에서 로그인돼도 동작에는 문제 없음(앱에서 다시 로그인) |
