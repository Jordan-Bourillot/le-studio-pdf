import io
from pathlib import Path
from typing import Literal

from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color


WatermarkPosition = Literal[
    "bottom-right", "bottom-center", "bottom-left",
    "top-right", "top-center", "top-left",
]


class WatermarkError(Exception):
    pass


def _make_diagonal_watermark(text: str, page_width: float, page_height: float, opacity: float) -> "PageObject":
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(page_width, page_height))
    c.setFillColor(Color(0.4, 0.4, 0.4, alpha=opacity))
    font_size = min(page_width, page_height) / 9
    c.setFont("Helvetica-Bold", font_size)
    c.saveState()
    c.translate(page_width / 2, page_height / 2)
    c.rotate(45)
    c.drawCentredString(0, 0, text)
    c.restoreState()
    c.save()
    buf.seek(0)
    return PdfReader(buf).pages[0]


def add_text_watermark(input_path: str, output_path: str, text: str, opacity: float = 0.3) -> dict:
    src = Path(input_path)
    if not src.exists():
        raise WatermarkError(f"Fichier introuvable : {src.name}")
    if not text or not text.strip():
        raise WatermarkError("Le texte du filigrane est vide.")
    if not 0.05 <= opacity <= 1.0:
        opacity = 0.3

    out = Path(output_path)
    if out.suffix.lower() != ".pdf":
        out = out.with_suffix(".pdf")
    out.parent.mkdir(parents=True, exist_ok=True)

    try:
        reader = PdfReader(str(src))
    except PdfReadError as e:
        raise WatermarkError(f"PDF illisible : {e}") from e
    except Exception as e:
        raise WatermarkError(f"Lecture impossible : {e}") from e

    if reader.is_encrypted:
        raise WatermarkError("Le fichier est protégé par mot de passe.")

    writer = PdfWriter()
    try:
        for page in reader.pages:
            mb = page.mediabox
            w = float(mb.width)
            h = float(mb.height)
            wm = _make_diagonal_watermark(text, w, h, opacity)
            page.merge_page(wm)
            writer.add_page(page)
        try:
            with open(out, "wb") as f:
                writer.write(f)
        except OSError as e:
            raise WatermarkError(f"Écriture impossible : {e}") from e
    finally:
        writer.close()

    return {
        "path": str(out),
        "filename": out.name,
        "page_count": len(reader.pages),
        "size_bytes": out.stat().st_size,
    }


def _make_page_number_overlay(text: str, page_width: float, page_height: float, position: str) -> "PageObject":
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(page_width, page_height))
    c.setFillColor(Color(0.25, 0.25, 0.25, alpha=0.85))
    c.setFont("Helvetica", 10)

    margin = 28
    positions = {
        "bottom-right": (page_width - margin, margin, "right"),
        "bottom-center": (page_width / 2, margin, "center"),
        "bottom-left": (margin, margin, "left"),
        "top-right": (page_width - margin, page_height - margin, "right"),
        "top-center": (page_width / 2, page_height - margin, "center"),
        "top-left": (margin, page_height - margin, "left"),
    }
    if position not in positions:
        position = "bottom-right"
    x, y, anchor = positions[position]

    if anchor == "center":
        c.drawCentredString(x, y, text)
    elif anchor == "right":
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)

    c.save()
    buf.seek(0)
    return PdfReader(buf).pages[0]


def add_page_numbers(input_path: str, output_path: str,
                     position: str = "bottom-right",
                     fmt: str = "{n} / {total}",
                     start_at: int = 1) -> dict:
    src = Path(input_path)
    if not src.exists():
        raise WatermarkError(f"Fichier introuvable : {src.name}")
    if start_at < 1:
        start_at = 1

    out = Path(output_path)
    if out.suffix.lower() != ".pdf":
        out = out.with_suffix(".pdf")
    out.parent.mkdir(parents=True, exist_ok=True)

    try:
        reader = PdfReader(str(src))
    except PdfReadError as e:
        raise WatermarkError(f"PDF illisible : {e}") from e
    except Exception as e:
        raise WatermarkError(f"Lecture impossible : {e}") from e

    if reader.is_encrypted:
        raise WatermarkError("Le fichier est protégé par mot de passe.")

    total = len(reader.pages)
    writer = PdfWriter()
    try:
        for idx, page in enumerate(reader.pages):
            n = idx + start_at
            text = fmt.replace("{n}", str(n)).replace("{total}", str(total))
            mb = page.mediabox
            w = float(mb.width)
            h = float(mb.height)
            ov = _make_page_number_overlay(text, w, h, position)
            page.merge_page(ov)
            writer.add_page(page)
        try:
            with open(out, "wb") as f:
                writer.write(f)
        except OSError as e:
            raise WatermarkError(f"Écriture impossible : {e}") from e
    finally:
        writer.close()

    return {
        "path": str(out),
        "filename": out.name,
        "page_count": total,
        "size_bytes": out.stat().st_size,
    }
