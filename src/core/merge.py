from pathlib import Path
from typing import Sequence

from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError


class MergeError(Exception):
    pass


def merge_pdfs(input_paths: Sequence[str], output_path: str) -> dict:
    paths = [Path(p) for p in input_paths]
    if len(paths) < 2:
        raise MergeError("Au moins 2 fichiers PDF sont requis pour fusionner.")

    for p in paths:
        if not p.exists():
            raise MergeError(f"Fichier introuvable : {p.name}")
        if p.suffix.lower() != ".pdf":
            raise MergeError(f"Pas un PDF : {p.name}")

    out = Path(output_path)
    if out.suffix.lower() != ".pdf":
        out = out.with_suffix(".pdf")
    out.parent.mkdir(parents=True, exist_ok=True)

    writer = PdfWriter()
    total_pages = 0

    try:
        for p in paths:
            try:
                reader = PdfReader(str(p))
            except PdfReadError as e:
                raise MergeError(f"PDF illisible : {p.name} ({e})") from e
            except Exception as e:
                raise MergeError(f"Lecture impossible : {p.name}") from e

            if reader.is_encrypted:
                raise MergeError(f"Fichier protégé par mot de passe : {p.name}")

            for page in reader.pages:
                writer.add_page(page)
            total_pages += len(reader.pages)

        try:
            with open(out, "wb") as f:
                writer.write(f)
        except OSError as e:
            raise MergeError(f"Écriture impossible : {e}") from e
    finally:
        writer.close()

    return {
        "path": str(out),
        "filename": out.name,
        "page_count": total_pages,
        "size_bytes": out.stat().st_size,
        "input_count": len(paths),
    }
