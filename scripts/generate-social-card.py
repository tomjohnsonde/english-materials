from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BACKGROUND = ROOT / "assets" / "social-background.png"
OUTPUT = ROOT / "assets" / "social-card.png"
SIZE = (1200, 630)


def font(size, bold=False):
    name = "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf"
    return ImageFont.truetype(name, size)


def main():
    source = Image.open(BACKGROUND).convert("RGB")
    card = source.resize(SIZE, Image.Resampling.LANCZOS)
    overlay = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for x in range(800):
        alpha = int(76 * (1 - (x / 800)))
        draw.line((x, 0, x, SIZE[1]), fill=(17, 18, 20, alpha))
    card = Image.alpha_composite(card.convert("RGBA"), overlay)
    draw = ImageDraw.Draw(card)
    coral = (216, 76, 71, 255)
    paper = (249, 248, 245, 255)
    muted = (212, 211, 208, 255)
    draw.text((74, 79), "OFFICIAL LEARNING MATERIALS", font=font(20, True), fill=coral, spacing=2)
    draw.text((74, 160), "ENGLISH", font=font(78, True), fill=paper)
    draw.text((74, 247), "MATERIALS", font=font(78, True), fill=paper)
    draw.text((76, 362), "Practical English resources for focused learners", font=font(30), fill=muted)
    draw.text((76, 532), "Tom Johnson", font=font(22, True), fill=paper)
    card.convert("RGB").save(OUTPUT, "PNG", optimize=True)


if __name__ == "__main__":
    main()
