#!/usr/bin/env python3
"""Regenere les icones de l'extension (icons/icon*.png) a partir de formes
vectorielles simples dessinees avec Pillow. Aucune ressource externe,
aucune image tierce : tout est trace en code pour rester libre de droits.

Usage : python3 tools/generate_icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

SIZES = (16, 32, 48, 128)
OUT_DIR = Path(__file__).resolve().parent.parent / "icons"

BG = (37, 99, 235, 255)  # bleu accent, coherent avec sidepanel.css --accent
WHITE = (255, 255, 255, 255)
PIN = (255, 213, 79, 255)  # jaune pense-bete


def draw_icon(size: int) -> Image.Image:
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = s * 0.22
    draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=BG)

    # "Note" : rectangle blanc avec coin plie, evoquant un pense-bete.
    margin = s * 0.22
    note_w = s - margin * 2
    note_h = s - margin * 2
    fold = note_w * 0.28
    x0, y0 = margin, margin
    x1, y1 = margin + note_w, margin + note_h

    draw.polygon(
        [
            (x0, y0),
            (x1 - fold, y0),
            (x1, y0 + fold),
            (x1, y1),
            (x0, y1),
        ],
        fill=WHITE,
    )
    draw.polygon(
        [
            (x1 - fold, y0),
            (x1, y0 + fold),
            (x1 - fold, y0 + fold),
        ],
        fill=(210, 226, 252, 255),
    )

    # Lignes de texte a l'interieur de la note.
    line_x0 = x0 + note_w * 0.16
    line_x1 = x1 - note_w * 0.16
    line_h = max(1, int(s * 0.045))
    for i, frac in enumerate((0.42, 0.58, 0.74)):
        y = y0 + note_h * frac
        end_x = line_x1 if i < 2 else line_x0 + (line_x1 - line_x0) * 0.6
        draw.rounded_rectangle([line_x0, y, end_x, y + line_h], radius=line_h / 2, fill=BG)

    # Petit "pin" en haut a droite pour l'aspect pense-bete/rappel.
    pin_r = s * 0.10
    pin_cx = x1 - fold * 0.35
    pin_cy = y0 + fold * 0.35
    draw.ellipse(
        [pin_cx - pin_r, pin_cy - pin_r, pin_cx + pin_r, pin_cy + pin_r],
        fill=PIN,
        outline=BG,
        width=max(1, int(s * 0.01)),
    )

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        icon = draw_icon(size)
        out_path = OUT_DIR / f"icon{size}.png"
        icon.save(out_path)
        print(f"ecrit {out_path}")


if __name__ == "__main__":
    main()
