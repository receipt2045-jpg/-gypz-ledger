/*
 * 앱이 아예 못 뜰 때 흰 화면 대신 안내 (2026-11-19 제보: "카톡으로 받은 링크를 누르면 흰 화면, 바깥 브라우저는 열려요").
 * 카톡 안 브라우저는 폰에 깔린 웹뷰를 쓰는데, 오래된 웹뷰면 앱 파일이 실행되지 못해 화면이 하얗게 남는다.
 * 그럴 땐 React가 뜨기 전이라 앱 안의 오류 안내(ErrorBoundary)도 못 쓴다 — 그래서 옛날 문법(ES5)으로 따로 둔다.
 * 오류 글을 화면에 보여 줘서 캡처로 원인을 알 수 있게 하고, 카톡이면 바깥 브라우저로 여는 버튼을 준다.
 */
(function () {
  // 카톡·인스타·네이버·라인·페북 앱 안 브라우저
  var IN_APP = /kakaotalk|instagram|naver|line\/|fban|fbav/i
  var errors = []
  window.addEventListener(
    'error',
    function (e) {
      var t = e && e.target
      if (t && t !== window && (t.src || t.href)) errors.push('파일을 못 불러옴: ' + (t.src || t.href))
      else errors.push((e.message || '오류') + (e.filename ? ' @' + e.filename.split('/').pop() + ':' + e.lineno : ''))
    },
    true
  )
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason
    errors.push('rejection: ' + ((r && r.message) || r))
  })

  function rootEmpty() {
    var root = document.getElementById('root')
    return !root || root.children.length === 0
  }

  function show() {
    if (!rootEmpty() || document.getElementById('boot-fallback')) return
    var ua = navigator.userAgent || ''
    var kakao = /kakaotalk/i.test(ua)
    var inApp = IN_APP.test(ua)
    var ios = /iphone|ipad|ipod/i.test(ua)
    var url = location.href
    var box = document.createElement('div')
    box.id = 'boot-fallback'
    box.setAttribute(
      'style',
      'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:#F2F4F6;display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,system-ui,sans-serif'
    )
    var btn =
      'display:block;width:100%;height:48px;border:0;border-radius:12px;font-size:15px;font-weight:700;margin-top:8px'
    box.innerHTML =
      '<div style="max-width:340px;width:100%;background:#fff;border-radius:18px;padding:24px;text-align:center">' +
      '<p style="margin:0;font-size:17px;font-weight:700;color:#191F28">' +
      (inApp ? '외부 브라우저로 열어 주세요' : '화면을 열지 못했어요') +
      '</p>' +
      '<p style="margin:8px 0 16px;font-size:14px;line-height:1.6;color:#4E5968">' +
      (kakao
        ? '카카오톡 안에서는 화면이 안 열릴 때가 있어요.<br>아래 버튼을 누르면 ' + (ios ? '사파리로' : '크롬으로') + ' 바로 열려요.'
        : inApp
          ? '이 앱 안에서는 화면이 안 열릴 때가 있어요.<br>' + (ios ? '사파리로' : '크롬으로') + ' 열면 바로 보여요.'
          : '다시 열거나 다른 브라우저로 열어 보세요.') +
      '</p>' +
      (kakao
        ? '<button id="boot-ext" style="' + btn + ';background:#3182F6;color:#fff">외부 브라우저로 열기</button>'
        : '') +
      (inApp
        ? '<p style="margin:12px 0 4px;font-size:12.5px;line-height:1.6;color:#4E5968">' +
          (ios
            ? '안 되면 오른쪽 아래 <b>공유 버튼</b> → <b>Safari로 열기</b>'
            : '안 되면 오른쪽 위 <b>⋮</b> → <b>다른 브라우저로 열기</b>') +
          '</p>'
        : '') +
      '<button id="boot-reload" style="' + btn + ';background:#F2F4F6;color:#4E5968">다시 열기</button>' +
      '<p style="margin:16px 0 0;font-size:11px;line-height:1.5;color:#8B95A1;word-break:break-all">' +
      (errors.length ? errors.slice(0, 3).join('<br>').replace(/</g, '&lt;').replace(/&lt;br>/g, '<br>') : '시간 초과') +
      '<br>' +
      ua.replace(/</g, '&lt;') +
      '</p></div>'
    document.body.appendChild(box)
    var ext = document.getElementById('boot-ext')
    if (ext)
      ext.onclick = function () {
        location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url)
      }
    document.getElementById('boot-reload').onclick = function () {
      location.reload()
    }
    // 늦게라도 앱이 뜨면 안내를 걷는다
    var iv = setInterval(function () {
      if (!rootEmpty()) {
        clearInterval(iv)
        if (box.parentNode) box.parentNode.removeChild(box)
      }
    }, 500)
  }

  // 오류가 났으면 4초, 아니면 12초(앱 안 브라우저는 6초) 기다려도 화면이 비어 있을 때만
  setTimeout(function () {
    if (errors.length) show()
  }, 4000)
  setTimeout(show, IN_APP.test(navigator.userAgent || '') ? 6000 : 12000)
})()
