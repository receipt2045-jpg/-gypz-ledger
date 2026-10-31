import type { CapacitorConfig } from '@capacitor/cli'

// 앱은 moabuli.com을 불러온다 — 사이트를 배포하면 앱 화면도 바뀐다 (설계: docs/superpowers/specs/2026-10-31-hybrid-android-shell-design.md)
const config: CapacitorConfig = {
  appId: 'moabuli.app',
  appName: '모아불리',
  webDir: 'android-web',
  server: {
    url: 'https://moabuli.com/?src=app#/',
    errorPath: 'offline.html',
    allowNavigation: ['moabuli.com', 'www.moabuli.com', '*.supabase.co'],
  },
  android: { backgroundColor: '#F2F4F6' },
  plugins: {
    // 구글 로그인만 쓴다 — facebook을 끄면 Facebook SDK와 광고 ID·AdServices 권한이 앱에 안 들어간다.
    // 이 값은 `npx cap sync` 때 플러그인 쪽 gradle.properties로 옮겨지므로, 빌드 전에 꼭 sync한다.
    SocialLogin: {
      providers: { google: true, facebook: false, apple: false, twitter: false },
    },
  },
}
export default config
