from pathlib import Path
from typing import List

from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError


class SplitError(Exception):
    pass


def parse_ranges(spec: str, max_page: int) -> List[int]:
    spec = (spec or "").strip().replace(" ", "")
    if not spec:
        raise SplitError("Indiquez les pages à extraire.")
    pages: List[int] = []
    for part in spec.split(","):
        if not part:
            continue
        if "-" in part:
            try:
                a_str, b_str = part.split("-", 1)
                a = int(a_str)
                b = int(b_str)
            except ValueError:
                raise SplitError(f"Plage invalide : « {part} »")
            if a > b:
                raise SplitError(f"Plage invalide : « {part} » (début > fin)")
            if a < 1 or b > max_page:
                raise SplitError(f"Hors limite : « {part} » (PDF de {max_page} pages)")
            pages.extend(range(a, b + 1))
        else:
            try:
                p = int(part)
            except ValueError:
                raise SplitError(f"Numéro invalide : « {part} »")
            if p < 1 or p > max_page:
                raise SplitError(f"Page {p} hors limite (PDF de {max_page} pages).")
            pages.append(p)
    if not pages:
        raise SplitError("Aucune page indiquée.")

    seen = set()
    unique = []
    for p in pages:
        if p not in seen:
            seen.add(p)
            unique.append(p)
    return unique


def split_pdf(input_path: str, output_path: str, ranges_spec: str) -> dict:
    src = Path(input_path)
    if not src.exists():
        raise SplitError(f"Fichier introuvable : {src.name}")
    if src.suffix.lower() != ".pdf":
        raise SplitError("Pas un fichier PDF.")

    out = Path(output_path)
    if out.suffix.lower() != ".pdf":
        out = out.with_suffix(".pdf")
    out.parent.mkdir(parents=True, exist_ok=True)

    try:
        reader = PdfReader(str(src))
    except PdfReadError as e:
        raise SplitError(f"PDF illisible : {e}") from e
    except Exception as e:
        raise SplitError(f"Lecture impossible : {e}") from e

    if reader.is_encrypted:
        raise SplitError("Le fichier est protégé par mot de passe.")

    total = len(reader.pages)
    pages = parse_ranges(ranges_spec, total)

    writer = PdfWriter()
    try:
        for p in pages:
            writer.add_page(reader.pages[p - 1])
        try:
            with open(out, "wb") as f:
                writer.write(f)
        except OSError as e:
            raise SplitError(f"Écriture impossible : {e}") from e
    finally:
        writer.close()

    return {
        "path": str(out),
        "filename": out.name,
        "page_count": len(pages),
        "size_bytes": out.stat().st_size,
        "ranges": ranges_spec,
        "extracted_pages": pages,
        "source_total": total,
    }
