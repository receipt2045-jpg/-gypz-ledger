"""
링크 미리보기 그림 (카톡·문자에 링크를 붙이면 뜨는 카드) — 2026-10-06.

예전 og-image.png는 파란 배경에 옛 돼지 아이콘이었다. 새 아이콘(부부 동전 코)으로 바꾸고,
오늘의 경제 링크(moabuli.com/news)는 전용 카드를 따로 쓴다.

실행:  py scripts/make-og.py
결과:  public/og-image.png  — 앱 첫 화면 링크
       public/og-news.png   — moabuli.com/news 링크
"""
import importlib.util
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
W, H = 1200, 630
WHITE = (255, 255, 255)
INK = (25, 31, 40)  # #191F28
BRAND = (49, 130, 246)  # #3182F6
CAP = (139, 149, 161)  # #8B95A1

# 아이콘 모양은 make-icons.py 하나에서만 정한다
_spec = importlib.util.spec_from_file_location("make_icons", ROOT / "scripts" / "make-icons.py")
icons = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(icons)

FONT_DIRS = [
    Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "Windows" / "Fonts",
    Path("C:/Windows/Fonts"),
]


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    """Pretendard(앱 글꼴)가 있으면 그걸, 없으면 맑은 고딕"""
    names = [f"Pretendard-{weight}.otf", "malgunbd.ttf" if weight == "Bold" else "malgun.ttf"]
    for d in FONT_DIRS:
        for n in names:
            if (d / n).exists():
                return ImageFont.truetype(str(d / n), size)
    raise SystemExit("글꼴을 못 찾았어요 (Pretendard 또는 맑은 고딕)")


def coins(size: int) -> Image.Image:
    return icons.draw(size).convert("RGB")


def app_card() -> Image.Image:
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)
    c = coins(300)
    img.paste(c, ((W - 300) // 2, 95))
    f = font("Bold", 64)
    text = "모아불리 가계부"
    tw = d.textlength(text, font=f)
    d.text(((W - tw) / 2, 410), text, font=f, fill=INK)
    return img


def news_card() -> Image.Image:
    img = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(img)
    size = 300
    f_small, f_big, f_sub = font("Bold", 44), font("Bold", 104), font("Medium", 40)
    lines = [("결영이네", f_small, BRAND), ("오늘의 경제", f_big, INK), ("매일 아침 · 날짜별로 모아 보기", f_sub, CAP)]
    text_w = max(d.textlength(t, font=f) for t, f, _ in lines)
    gap = 40
    x0 = (W - (size + gap + text_w)) / 2
    img.paste(coins(size), (int(x0), (H - size) // 2))
    tx = x0 + size + gap
    y = 168
    for (t, f, col), dy in zip(lines, (66, 140, 0)):
        d.text((tx, y), t, font=f, fill=col)
        y += dy
    return img


def main():
    app_card().save(PUBLIC / "og-image.png", optimize=True)
    news_card().save(PUBLIC / "og-news.png", optimize=True)
    print("og images written")


if __name__ == "__main__":
    main()
