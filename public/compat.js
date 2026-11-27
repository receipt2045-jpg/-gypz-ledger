/*
 * 오래된 폰 브라우저에서도 앱이 뜨게 — 없는 기능만 채운다 (2026-11-27 제보:
 * "초대 링크를 카톡에서 누르면 외부 브라우저로 열기가 뜨고, 눌러도 화면이 계속 안 떠요. 첫 오티날이랑 똑같아요").
 * 업데이트가 멈춘 안드로이드 폰은 카톡 안 브라우저와 크롬이 같은 옛 엔진을 써서, 바깥 브라우저로 옮겨도 똑같이 안 떴다.
 * 문법은 빌드에서 옛 문법으로 바꾸고(vite.config.ts build.target), 여기선 옛 엔진에 없는 함수만 채운다.
 * 앱 파일보다 먼저 실행돼야 해서 옛날 문법(ES5)으로 따로 둔다. 이미 있는 기능은 건드리지 않는다.
 */
(function () {
  function def(obj, name, fn) {
    if (obj && !obj[name])
      try {
        Object.defineProperty(obj, name, { value: fn, configurable: true, writable: true })
      } catch (e) {
        obj[name] = fn
      }
  }

  // globalThis (크롬 71)
  if (typeof globalThis === 'undefined') window.globalThis = window

  // [].at(-1) (크롬 92 · 사파리 15.4)
  function at(n) {
    n = Math.trunc ? Math.trunc(n) || 0 : parseInt(n, 10) || 0
    if (n < 0) n += this.length
    return n < 0 || n >= this.length ? undefined : this[n]
  }
  def(Array.prototype, 'at', at)
  def(String.prototype, 'at', function (n) {
    var v = at.call(this, n)
    return v === undefined ? undefined : String(v)
  })

  // [].flat · [].flatMap (크롬 69 · 사파리 12)
  def(Array.prototype, 'flat', function (depth) {
    depth = depth === undefined ? 1 : Number(depth)
    var out = []
    ;(function walk(arr, d) {
      for (var i = 0; i < arr.length; i++) {
        if (Array.isArray(arr[i]) && d > 0) walk(arr[i], d - 1)
        else if (i in arr) out.push(arr[i])
      }
    })(this, depth)
    return out
  })
  def(Array.prototype, 'flatMap', function (fn, thisArg) {
    return Array.prototype.map.call(this, fn, thisArg).flat(1)
  })

  // Object.fromEntries (크롬 73 · 사파리 12.1)
  def(Object, 'fromEntries', function (entries) {
    var o = {}
    if (entries && typeof entries.forEach === 'function' && !Array.isArray(entries)) {
      entries.forEach(function (v, k) {
        if (Array.isArray(v)) o[v[0]] = v[1]
        else o[k] = v
      })
      return o
    }
    for (var i = 0; i < entries.length; i++) o[entries[i][0]] = entries[i][1]
    return o
  })

  // Promise.allSettled (크롬 76 · 사파리 13)
  if (typeof Promise !== 'undefined')
    def(Promise, 'allSettled', function (list) {
      return Promise.all(
        Array.prototype.map.call(list, function (p) {
          return Promise.resolve(p).then(
            function (value) {
              return { status: 'fulfilled', value: value }
            },
            function (reason) {
              return { status: 'rejected', reason: reason }
            }
          )
        })
      )
    })

  // String.replaceAll (크롬 85 · 사파리 13.1) — 글자 그대로 바꾸는 경우만
  def(String.prototype, 'replaceAll', function (search, rep) {
    if (search instanceof RegExp) return this.replace(search, rep)
    return this.split(String(search)).join(typeof rep === 'function' ? rep(String(search)) : rep)
  })

  // crypto.randomUUID (크롬 92 · 사파리 15.4)
  var c = window.crypto
  if (c && !c.randomUUID && c.getRandomValues)
    def(c, 'randomUUID', function () {
      var b = new Uint8Array(16)
      c.getRandomValues(b)
      b[6] = (b[6] & 0x0f) | 0x40
      b[8] = (b[8] & 0x3f) | 0x80
      var h = []
      for (var i = 0; i < 16; i++) h.push((b[i] + 0x100).toString(16).slice(1))
      return (
        h.slice(0, 4).join('') +
        '-' +
        h.slice(4, 6).join('') +
        '-' +
        h.slice(6, 8).join('') +
        '-' +
        h.slice(8, 10).join('') +
        '-' +
        h.slice(10).join('')
      )
    })
})()
