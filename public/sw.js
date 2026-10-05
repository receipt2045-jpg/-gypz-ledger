// 모아불리 서비스 워커 — 앱 설치(홈 화면 · 플레이 스토어)에 필요한 최소한만 한다.
//
// 화면 파일(JS·CSS)은 저장하지 않는다. 옛 파일을 붙잡고 있으면 새로 배포해도 안 보이기 때문이다.
// 인터넷이 끊긴 채로 앱을 열었을 때만 안내 화면(offline.html)을 보여준다.
const CACHE = 'moabuli-offline-v1'
const OFFLINE = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)))
})
