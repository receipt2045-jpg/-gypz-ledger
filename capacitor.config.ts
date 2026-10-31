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
}
export default config
