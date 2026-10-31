#!/usr/bin/env bash
# 안드로이드 릴리스 빌드 (AAB + APK). `npm run android:release`가 이 스크립트를 부른다.
# 한글 경로 때문에 M: 드라이브를 잠깐 만들어 거기서 빌드하고, 끝나면 지운다.
# 서명 정보는 ~/.gradle/gradle.properties에서 읽는다 (여기서 출력하지 않는다).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_WIN="$(cygpath -w "$ROOT")"
DRIVE="M:"
export JAVA_HOME="${JAVA_HOME_21:-$HOME/android-build/jdk21}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-build/sdk}"
APKSIGNER="$(ls -d "$ANDROID_HOME"/build-tools/*/lib/apksigner.jar | sort -V | tail -1)"
OUT_DIR="$ROOT/../play-store/build"
EXPECTED="4fdca129b5c9d53245b543fec2f9ee396e5736ebb979f5569401ef5f3924b90c"

[ -x "$JAVA_HOME/bin/java" ] || { echo "JDK 21이 없어요: $JAVA_HOME"; exit 1; }

echo "== 1/4 cap sync"
(cd "$ROOT" && npx cap sync android)

echo "== 2/4 gradle 릴리스 빌드 ($DRIVE)"
cmd //c "subst $DRIVE /D" >/dev/null 2>&1 || true
cmd //c "subst $DRIVE $ROOT_WIN"
trap 'cmd //c "subst '"$DRIVE"' /D" >/dev/null 2>&1 || true' EXIT
env -u NoDefaultCurrentDirectoryInExePath cmd //c "$DRIVE && cd \android && gradlew.bat bundleRelease assembleRelease"

AAB="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
MANIFEST="$ROOT/android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml"

echo "== 3/4 합쳐진 매니페스트 검사"
fail=0
for bad in AD_ID ADSERVICES facebook USE_BIOMETRIC USE_FINGERPRINT; do
  if grep -qi "$bad" "$MANIFEST"; then echo "  [실패] 매니페스트에 $bad 가 있어요"; fail=1; fi
done
[ "$fail" = 0 ] || exit 1
echo "  금지 항목 없음 (AD_ID, ADSERVICES, facebook, USE_BIOMETRIC, USE_FINGERPRINT)"
grep -o -E 'package="[^"]*"|android:versionCode="[^"]*"|android:versionName="[^"]*"|android:allowBackup="[^"]*"' "$MANIFEST" | sed 's/^/  /'

echo "== 4/4 서명 확인 + 복사"
SIG="$("$JAVA_HOME/bin/java" -jar "$APKSIGNER" verify --print-certs "$APK" | tr -d '' | grep "Signer #1 certificate SHA-256" | sed "s/.*: //" | tr -d '[:space:]')"
echo "  서명 SHA-256: $SIG"
[ "$SIG" = "$EXPECTED" ] || { echo "  [실패] 업로드 키와 달라요"; exit 1; }
mkdir -p "$OUT_DIR"
cp "$AAB" "$OUT_DIR/moabuli-1.1.0.aab"
cp "$APK" "$OUT_DIR/moabuli-1.1.0.apk"
echo "  복사 완료: $(cd "$OUT_DIR" && pwd)/moabuli-1.1.0.{aab,apk}"
