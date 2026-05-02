from pathlib import Path
from pypdf import PdfReader
from pypdf.errors import PdfReadError


class InvalidPDFError(Exception):
    pass


def inspect(file_path: str) -> dict:
    path = Path(file_path)
    if not path.exists():
        raise InvalidPDFError(f"Fichier introuvable : {file_path}")
    if path.suffix.lower() != ".pdf":
        raise InvalidPDFError("Ce fichier n'est pas un PDF.")
    try:
        reader = PdfReader(str(path))
        encrypted = reader.is_encrypted
        page_count = 0 if encrypted else len(reader.pages)
        meta = {} if encrypted else (reader.metadata or {})
        title = meta.get("/Title") if meta else None
        return {
            "path": str(path),
            "filename": path.name,
            "size_bytes": path.stat().st_size,
            "page_count": page_count,
            "encrypted": encrypted,
            "title": str(title) if title else None,
        }
    except PdfReadError as e:
        raise InvalidPDFError(f"PDF invalide ou corrompu : {e}") from e
    except Exception as e:
        raise InvalidPDFError(f"Impossible de lire le fichier : {e}") from e
