/*
 * 카톡에서 링크를 열면 바로 크롬(아이폰은 사파리)으로 넘긴다 (2026-11-27 결영 결정).
 * 제보: 6기 초대 링크를 카톡에서 누르면 화면이 안 뜨고 '외부 브라우저로 열기' 안내만 남았다 (오티날도 같았다).
 * 카톡 안 브라우저는 앱마다 저장 공간이 따로라 로그인도 매번 풀리고, 구글 로그인은 막혀 있다.
 * 앱 파일보다 먼저, 페이지 맨 위에서 실행된다 — 앱이 멈춰도 넘어간다. 옛날 문법(ES5)으로 둔다.
 * 한 번 넘긴 주소는 이 창에서 다시 넘기지 않는다(뒤로 가기·새로고침 때 계속 튕기지 않게).
 * 카톡 안에 남은 화면엔 '크롬으로 열었어요' 안내를 띄우고, '카톡에서 그냥 볼게요'를 누르면 원래대로 쓴다.
 */
(function () {
  var ua = navigator.userAgent || ''
  if (!/kakaotalk/i.test(ua)) return
  var ios = /iphone|ipad|ipod/i.test(ua)
  var browser = ios ? '사파리' : '크롬'
  var url = location.href
  var out = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url)

  var key = 'moabuli.kakaoOut:' + url
  var already = false
  try {
    already = !!sessionStorage.getItem(key)
    sessionStorage.setItem(key, '1')
  } catch (e) {
    /* 기록을 못 하면 한 번만 넘긴다 — 아래에서 막는다 */
    if (window.__mbKakaoOut) already = true
  }
  if (already) return
  window.__mbKakaoOut = true
  location.href = out

  // 카톡 안에 남은 화면 — 넘어간 걸 알려 주고, 안 넘어갔으면 다시 누르거나 여기서 쓴다
  function notice() {
    if (document.getElementById('kakao-out')) return
    var box = document.createElement('div')
    box.id = 'kakao-out'
    box.setAttribute(
      'style',
      'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;background:#F2F4F6;display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,system-ui,sans-serif'
    )
    var btn =
      'display:block;width:100%;height:48px;border:0;border-radius:12px;font-size:15px;font-weight:700;margin-top:8px'
    box.innerHTML =
      '<div style="max-width:340px;width:100%;background:#fff;border-radius:18px;padding:24px;text-align:center">' +
      '<p style="margin:0;font-size:17px;font-weight:700;color:#191F28">' +
      browser +
      '으로 열었어요</p>' +
      '<p style="margin:8px 0 16px;font-size:14px;line-height:1.6;color:#4E5968">' +
      browser +
      '에서 계속 써 주세요.<br>로그인이 유지돼서 다음부터 편해요.</p>' +
      '<button id="kakao-out-again" style="' +
      btn +
      ';background:#3182F6;color:#fff">' +
      browser +
      '으로 다시 열기</button>' +
      '<button id="kakao-out-stay" style="' +
      btn +
      ';background:#F2F4F6;color:#4E5968">카톡에서 그냥 볼게요</button>' +
      '</div>'
    document.body.appendChild(box)
    document.getElementById('kakao-out-again').onclick = function () {
      location.href = out
    }
    document.getElementById('kakao-out-stay').onclick = function () {
      if (box.parentNode) box.parentNode.removeChild(box)
    }
  }
  if (document.body) notice()
  else document.addEventListener('DOMContentLoaded', notice)
})()
