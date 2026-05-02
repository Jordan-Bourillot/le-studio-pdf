import shutil
from pathlib import Path


class OcrError(Exception):
    pass


class OcrMissingDeps(OcrError):
    pass


def check_deps() -> dict:
    tesseract = shutil.which("tesseract")
    gs = shutil.which("gswin64c") or shutil.which("gswin32c") or shutil.which("gs")
    return {
        "tesseract": bool(tesseract),
        "ghostscript": bool(gs),
        "available": bool(tesseract and gs),
        "tesseract_path": tesseract,
        "ghostscript_path": gs,
    }


def run_ocr(input_path: str, output_path: str, language: str = "fra") -> dict:
    deps = check_deps()
    if not deps["available"]:
        missing = []
        if not deps["tesseract"]:
            missing.append("Tesseract OCR")
        if not deps["ghostscript"]:
            missing.append("Ghostscript")
        raise OcrMissingDeps(
            f"Dépendance manquante : {', '.join(missing)}. "
            "Installez-les puis relancez l'application."
        )

    src = Path(input_path)
    if not src.exists():
        raise OcrError(f"Fichier introuvable : {src.name}")
    if src.suffix.lower() != ".pdf":
        raise OcrError("Pas un fichier PDF.")

    out = Path(output_path)
    if out.suffix.lower() != ".pdf":
        out = out.with_suffix(".pdf")
    out.parent.mkdir(parents=True, exist_ok=True)

    try:
        import ocrmypdf
    except ImportError as e:
        raise OcrMissingDeps("Module ocrmypdf introuvable.") from e

    try:
        ocrmypdf.ocr(
            str(src),
            str(out),
            language=language,
            skip_text=True,
            optimize=0,
            progress_bar=False,
            deskew=False,
            clean=False,
        )
    except ocrmypdf.exceptions.MissingDependencyError as e:
        raise OcrMissingDeps(str(e)) from e
    except ocrmypdf.exceptions.EncryptedPdfError as e:
        raise OcrError("Le PDF est protégé par mot de passe.") from e
    except Exception as e:
        raise OcrError(f"OCR échoué : {e}") from e

    return {
        "path": str(out),
        "filename": out.name,
        "size_bytes": out.stat().st_size,
        "language": language,
    }
