# 안드로이드 앱 빌드 방법

## 준비물 (이 PC에는 이미 있어요)
- JDK 21: `~/android-build/jdk21`
- 안드로이드 SDK: `~/android-build/sdk`
- 서명 정보: `~/.gradle/gradle.properties` (업로드 키 경로와 비밀번호. 이 파일과 키 파일은 git에 올리지 않아요)
- Git Bash와 Node (`npm install`은 한 번 해 두기)

## 명령 하나
레포 맨 위 폴더(gypz-ledger)에서:

```
npm run android:release
```

한글 경로 때문에 빌드하는 동안만 `M:` 드라이브를 잠깐 만들고, 끝나면 지워요.
순서는 이래요.
1. `npx cap sync android` (웹 자산과 플러그인 설정을 안드로이드에 맞춰요)
2. gradle로 AAB와 APK 빌드
3. 합쳐진 매니페스트에 `AD_ID`, `ADSERVICES`, `facebook`, `USE_BIOMETRIC`, `USE_FINGERPRINT`가 있으면 실패해요
4. APK 서명 SHA-256을 찍고, 업로드 키와 다르면 실패해요

## 결과물
- `android/app/build/outputs/bundle/release/app-release.aab`
- `android/app/build/outputs/apk/release/app-release.apk`
- 복사본: `가계부/play-store/build/moabuli-1.1.0.aab`, `moabuli-1.1.0.apk` (Play Console에는 aab를 올려요)

## 새 버전을 낼 때
`android/app/build.gradle`의 `versionCode`를 올리고 `versionName`을 바꿔요. 복사 파일 이름은 `scripts/android-release.sh`에서 바꿔요.

## 주의
- `npm install`이나 `npm ci`를 새로 했다면 꼭 이 명령으로 빌드해 주세요. cap sync를 빼먹으면 Facebook SDK가 다시 들어가요.
