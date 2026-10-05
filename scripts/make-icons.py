"""
모아불리 앱 아이콘 만들기 — '부부 동전 코' (2026-10-05 결정).

흰 동전(아내)과 검은 동전(남편)이 겹쳐 있고, 각각 돼지 코 구멍이 둘.
100칸 격자 위에 그린 모양을 8배로 크게 그린 뒤 줄여서 가장자리를 부드럽게 한다.

실행:  py scripts/make-icons.py
결과:  public/icons/icon-192.png, icon-512.png, maskable-512.png
       public/apple-touch-icon.png, public/favicon.svg
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
INK = (25, 31, 40, 255)  # #191F28 — 앱의 ink 색
WHITE = (255, 255, 255, 255)
SS = 8  # 슈퍼샘플링 배율

# 100칸 격자 기준 모양 (cx, cy, r) — 세로 가운데 50
# 두 동전을 살짝만 겹친다 — 많이 겹치면 흰 동전 코 구멍이 가려져 초승달처럼 보인다
COIN_R = 21
STROKE = 5
WIFE = (33, 50)  # 흰 동전
HUSBAND = (67, 50)  # 검은 동전
NOSE = (5, 3.2, 5.6)  # 코 구멍: 동전 중심에서 ±5, 반지름 가로 3.2 세로 5.6


def draw(size: int, scale: float = 1.0) -> Image.Image:
    """size 픽셀 정사각형. scale<1이면 가운데로 모아서(안드로이드 둥근 아이콘 여백) 그린다."""
    big = size * SS
    img = Image.new("RGBA", (big, big), WHITE)
    d = ImageDraw.Draw(img)
    u = big / 100 * scale
    off = big / 2 - 50 * u

    def P(x, y):
        return off + x * u, off + y * u

    def circle(c, r, fill):
        x, y = P(*c)
        d.ellipse([x - r * u, y - r * u, x + r * u, y + r * u], fill=fill)

    def nostril(cx, cy, fill):
        dx, rx, ry = NOSE
        for sx in (-dx, dx):
            x, y = P(cx + sx, cy)
            d.ellipse([x - rx * u, y - ry * u, x + rx * u, y + ry * u], fill=fill)

    outer = COIN_R + STROKE / 2
    inner = COIN_R - STROKE / 2
    # 흰 동전: 검은 테두리 + 흰 속
    circle(WIFE, outer, INK)
    circle(WIFE, inner, WHITE)
    nostril(*WIFE, INK)
    # 검은 동전이 위에 겹친다
    circle(HUSBAND, outer, INK)
    nostril(*HUSBAND, WHITE)

    return img.resize((size, size), Image.LANCZOS)


def favicon_svg() -> str:
    o = COIN_R + STROKE / 2
    i = COIN_R - STROKE / 2
    (wx, wy), (hx, hy) = WIFE, HUSBAND
    dx, rx, ry = NOSE
    return f"""<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- 모아불리 '부부 동전 코' — scripts/make-icons.py가 만든다 -->
  <rect width="100" height="100" rx="22" fill="#FFFFFF"/>
  <circle cx="{wx}" cy="{wy}" r="{o}" fill="#191F28"/>
  <circle cx="{wx}" cy="{wy}" r="{i}" fill="#FFFFFF"/>
  <ellipse cx="{wx - dx}" cy="{wy}" rx="{rx}" ry="{ry}" fill="#191F28"/>
  <ellipse cx="{wx + dx}" cy="{wy}" rx="{rx}" ry="{ry}" fill="#191F28"/>
  <circle cx="{hx}" cy="{hy}" r="{o}" fill="#191F28"/>
  <ellipse cx="{hx - dx}" cy="{hy}" rx="{rx}" ry="{ry}" fill="#FFFFFF"/>
  <ellipse cx="{hx + dx}" cy="{hy}" rx="{rx}" ry="{ry}" fill="#FFFFFF"/>
</svg>
"""


def main():
    icons = PUBLIC / "icons"
    icons.mkdir(exist_ok=True)
    draw(192).save(icons / "icon-192.png")
    draw(512).save(icons / "icon-512.png")
    # 안드로이드는 아이콘을 원·둥근 사각형 등으로 잘라낸다 — 가운데 80% 안에 들어오게 줄인다
    draw(512, scale=0.8).save(icons / "maskable-512.png")
    draw(180).save(PUBLIC / "apple-touch-icon.png")
    (PUBLIC / "favicon.svg").write_text(favicon_svg(), encoding="utf-8")
    print("icons written")


if __name__ == "__main__":
    main()
