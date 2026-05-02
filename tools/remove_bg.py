"""Retire le fond blanc des images de Bertrand."""
import os
from pathlib import Path

from PIL import Image


ASSETS = Path(r"C:\Users\jorda\Downloads\Triskell 4 - Studio PDF\ui\assets")
FILES = [
    "bertrand_greeting.png",
    "bertrand_success.png",
    "bertrand_logo.png",
    "bertrand_working.png",
    "bertrand_confused.png",
]
THRESHOLD = 235  # tout pixel > 235 sur R, G, B devient transparent


def remove_white_bg(path: Path) -> None:
    img = Image.open(path).convert("RGBA")
    data = img.getdata()
    new = []
    for r, g, b, a in data:
        if r >= THRESHOLD and g >= THRESHOLD and b >= THRESHOLD:
            new.append((255, 255, 255, 0))
        else:
            # Lisse les bords : opacite progressive sur les pixels gris-clair
            min_v = min(r, g, b)
            if min_v >= 215:
                alpha = int(255 * (THRESHOLD - min_v) / (THRESHOLD - 215))
                alpha = max(0, min(255, alpha))
                new.append((r, g, b, alpha))
            else:
                new.append((r, g, b, a))
    img.putdata(new)
    img.save(path, "PNG")
    print(f"OK : {path.name}")


def main() -> None:
    for f in FILES:
        p = ASSETS / f
        if not p.exists():
            print(f"!! introuvable : {f}")
            continue
        remove_white_bg(p)


if __name__ == "__main__":
    main()
