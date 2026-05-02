from pathlib import Path
from typing import Literal


ImageFormat = Literal["png", "jpeg"]


class ConvertError(Exception):
    pass


def convert_to_word(input_path: str, output_path: str) -> dict:
    src = Path(input_path)
    if not src.exists():
        raise ConvertError(f"Fichier introuvable : {src.name}")
    if src.suffix.lower() != ".pdf":
        raise ConvertError("Pas un fichier PDF.")

    out = Path(output_path)
    if out.suffix.lower() != ".docx":
        out = out.with_suffix(".docx")
    out.parent.mkdir(parents=True, exist_ok=True)

    try:
        from pdf2docx import Converter
    except ImportError as e:
        raise ConvertError(
            "Module pdf2docx introuvable. Relancez l'application pour installer les dépendances."
        ) from e

    try:
        cv = Converter(str(src))
        cv.convert(str(out), start=0, end=None)
        cv.close()
    except Exception as e:
        raise ConvertError(f"Conversion en Word échouée : {e}") from e

    return {
        "path": str(out),
        "filename": out.name,
        "size_bytes": out.stat().st_size,
        "kind": "word",
    }


def convert_to_images(input_path: str, output_dir: str, fmt: ImageFormat = "png", dpi: int = 144) -> dict:
    src = Path(input_path)
    if not src.exists():
        raise ConvertError(f"Fichier introuvable : {src.name}")
    if src.suffix.lower() != ".pdf":
        raise ConvertError("Pas un fichier PDF.")

    if fmt not in ("png", "jpeg"):
        fmt = "png"
    if dpi not in (72, 144, 300):
        dpi = 144
    scale = dpi / 72.0

    try:
        import pypdfium2 as pdfium
    except ImportError as e:
        raise ConvertError(
            "Module pypdfium2 introuvable. Relancez l'application pour installer les dépendances."
        ) from e

    out_dir = Path(output_dir) / f"{src.stem}_images"
    out_dir.mkdir(parents=True, exist_ok=True)

    pil_format = "PNG" if fmt == "png" else "JPEG"
    ext = "png" if fmt == "png" else "jpg"

    pdf = None
    files = []
    try:
        pdf = pdfium.PdfDocument(str(src))
        total = len(pdf)
        for i in range(total):
            page = pdf[i]
            img = page.render(scale=scale).to_pil()
            if pil_format == "JPEG" and img.mode in ("RGBA", "LA", "P"):
                img = img.convert("RGB")
            out_file = out_dir / f"page_{i + 1:03d}.{ext}"
            save_kwargs = {}
            if pil_format == "JPEG":
                save_kwargs["quality"] = 90
                save_kwargs["optimize"] = True
            img.save(str(out_file), pil_format, **save_kwargs)
            files.append(str(out_file))
            page.close()
    except ConvertError:
        raise
    except Exception as e:
        raise ConvertError(f"Conversion en images échouée : {e}") from e
    finally:
        if pdf is not None:
            pdf.close()

    total_bytes = sum((Path(f).stat().st_size for f in files), 0)
    return {
        "path": str(out_dir),
        "filename": out_dir.name,
        "size_bytes": total_bytes,
        "page_count": len(files),
        "format": fmt,
        "dpi": dpi,
        "kind": "images",
    }
