import { describe, expect, it } from 'vitest'
import { detectInAppBrowser } from './inAppBrowser'

describe('인앱 브라우저 감지', () => {
  it('카톡 안에서 열면 kakao로 잡는다', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 KAKAOTALK 10.4.5'
    expect(detectInAppBrowser(ua)).toBe('kakao')
  })

  it('인스타 안에서 열면 instagram으로 잡는다', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 Instagram 300.0.0'
    expect(detectInAppBrowser(ua)).toBe('instagram')
  })

  it('일반 사파리·크롬은 잡지 않는다', () => {
    expect(
      detectInAppBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBeNull()
    expect(
      detectInAppBrowser('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile'),
    ).toBeNull()
  })
})
