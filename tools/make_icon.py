"""Convertit bertrand_logo.png en bertrand.ico pour PyInstaller."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "ui" / "assets" / "bertrand_logo.png"
DEST = ROOT / "ui" / "assets" / "bertrand.ico"


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Source manquante : {SRC}")
    img = Image.open(SRC).convert("RGBA")
    # Crop on transparent bbox so the icon is well-centered
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    # Make it square (with transparent padding)
    w, h = img.size
    side = max(w, h)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(img, ((side - w) // 2, (side - h) // 2))
    square.save(
        DEST,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    print(f"OK : {DEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
