import io
from pathlib import Path
from typing import List

from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color


_COLORS = {
    "red":    (0.75, 0.18, 0.18),
    "blue":   (0.12, 0.27, 0.53),
    "green":  (0.18, 0.49, 0.20),
    "orange": (0.78, 0.40, 0.10),
    "black":  (0.10, 0.10, 0.18),
}

_POSITIONS = {
    "top-left", "top-center", "top-right",
    "center",
    "bottom-left", "bottom-center", "bottom-right",
}


class StampError(Exception):
    pass


def _parse_pages(spec: str, total: int) -> List[int]:
    spec = (spec or "").strip().lower()
    if spec == "all" or spec == "":
        return list(range(1, total + 1))
    if spec == "first":
        return [1]
    if spec == "last":
        return [total]

    pages: List[int] = []
    for part in spec.replace(" ", "").split(","):
        if not part:
            continue
        if "-" in part:
            try:
                a, b = part.split("-", 1)
                a, b = int(a), int(b)
            except ValueError:
                raise StampError(f"Plage invalide : « {part} »")
            if a > b or a < 1 or b > total:
                raise StampError(f"Plage hors limite : « {part} » (PDF de {total} pages)")
            pages.extend(range(a, b + 1))
        else:
            try:
                p = int(part)
            except ValueError:
                raise StampError(f"Numéro invalide : « {part} »")
            if p < 1 or p > total:
                raise StampError(f"Page {p} hors limite (PDF de {total} pages)")
            pages.append(p)

    if not pages:
        raise StampError("Aucune page indiquée.")
    seen = set()
    return [p for p in pages if not (p in seen or seen.add(p))]


def _make_stamp_overlay(text: str, page_w: float, page_h: float,
                        position: str, color_rgb: tuple) -> "PageObject":
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(page_w, page_h))

    # Tampon : rotation legere, double encadrement, opacite
    text = (text or "").upper()
    font_size = max(min(page_w, page_h) / 14, 18)
    c.setFont("Helvetica-Bold", font_size)

    text_width = c.stringWidth(text, "Helvetica-Bold", font_size)
    box_w = text_width + 28
    box_h = font_size * 1.7
    margin = 40

    positions_map = {
        "top-left": (margin, page_h - margin - box_h),
        "top-center": ((page_w - box_w) / 2, page_h - margin - box_h),
        "top-right": (page_w - margin - box_w, page_h - margin - box_h),
        "center": ((page_w - box_w) / 2, (page_h - box_h) / 2),
        "bottom-left": (margin, margin),
        "bottom-center": ((page_w - box_w) / 2, margin),
        "bottom-right": (page_w - margin - box_w, margin),
    }
    if position not in positions_map:
        position = "top-left"
    x, y = positions_map[position]

    r, g, b = color_rgb

    c.saveState()
    c.translate(x + box_w / 2, y + box_h / 2)
    c.rotate(-8)

    # Encadrement double
    c.setStrokeColor(Color(r, g, b, alpha=0.9))
    c.setFillColor(Color(r, g, b, alpha=0.0))
    c.setLineWidth(2.5)
    c.roundRect(-box_w / 2, -box_h / 2, box_w, box_h, 4, stroke=1, fill=0)
    c.setLineWidth(1)
    c.roundRect(-box_w / 2 + 4, -box_h / 2 + 4, box_w - 8, box_h - 8, 2, stroke=1, fill=0)

    # Texte
    c.setFillColor(Color(r, g, b, alpha=0.92))
    c.drawCentredString(0, -font_size / 3, text)

    c.restoreState()
    c.save()
    buf.seek(0)
    return PdfReader(buf).pages[0]


def add_stamp(input_path: str, output_path: str, text: str,
              position: str, color: str, pages_spec: str) -> dict:
    src = Path(input_path)
    if not src.exists():
        raise StampError(f"Fichier introuvable : {src.name}")
    if not text or not text.strip():
        raise StampError("Le texte du tampon est vide.")

    color_rgb = _COLORS.get(color, _COLORS["red"])
    if position not in _POSITIONS:
        position = "top-left"

    out = Path(output_path)
    if out.suffix.lower() != ".pdf":
        out = out.with_suffix(".pdf")
    out.parent.mkdir(parents=True, exist_ok=True)

    try:
        reader = PdfReader(str(src))
    except PdfReadError as e:
        raise StampError(f"PDF illisible : {e}") from e
    except Exception as e:
        raise StampError(f"Lecture impossible : {e}") from e

    if reader.is_encrypted:
        raise StampError("Le fichier est protégé par mot de passe.")

    total = len(reader.pages)
    target_pages = set(_parse_pages(pages_spec, total))

    writer = PdfWriter()
    stamped = 0
    try:
        for idx, page in enumerate(reader.pages):
            page_num = idx + 1
            if page_num in target_pages:
                mb = page.mediabox
                w = float(mb.width)
                h = float(mb.height)
                overlay = _make_stamp_overlay(text, w, h, position, color_rgb)
                page.merge_page(overlay)
                stamped += 1
            writer.add_page(page)
        try:
            with open(out, "wb") as f:
                writer.write(f)
        except OSError as e:
            raise StampError(f"Écriture impossible : {e}") from e
    finally:
        writer.close()

    return {
        "path": str(out),
        "filename": out.name,
        "page_count": total,
        "stamped_count": stamped,
        "size_bytes": out.stat().st_size,
        "text": text.upper(),
        "color": color,
        "position": position,
    }
