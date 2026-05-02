from pathlib import Path
from typing import Literal

import pikepdf


CompressLevel = Literal["mail", "web", "archive"]


class CompressError(Exception):
    pass


def _save_options(level: CompressLevel) -> dict:
    base = {
        "compress_streams": True,
        "object_stream_mode": pikepdf.ObjectStreamMode.generate,
        "normalize_content": False,
        "linearize": False,
    }
    if level == "archive":
        # Conservatif : on ne touche pas aux flux specialises
        return {**base, "stream_decode_level": pikepdf.StreamDecodeLevel.none}
    if level == "mail":
        # Le plus agressif possible cote pikepdf, mais sans casser la compatibilite lecteur
        return {**base, "stream_decode_level": pikepdf.StreamDecodeLevel.generalized, "linearize": True}
    # "web" par defaut
    return {**base, "stream_decode_level": pikepdf.StreamDecodeLevel.generalized}


def compress_pdf(input_path: str, output_path: str, level: CompressLevel = "web") -> dict:
    src = Path(input_path)
    if not src.exists():
        raise CompressError(f"Fichier introuvable : {src.name}")
    if src.suffix.lower() != ".pdf":
        raise CompressError("Pas un fichier PDF.")

    out = Path(output_path)
    if out.suffix.lower() != ".pdf":
        out = out.with_suffix(".pdf")
    out.parent.mkdir(parents=True, exist_ok=True)

    original_size = src.stat().st_size

    try:
        with pikepdf.open(str(src)) as pdf:
            if pdf.is_encrypted:
                raise CompressError("Le fichier est protégé par mot de passe.")
            pdf.save(str(out), **_save_options(level))
    except CompressError:
        raise
    except pikepdf.PasswordError:
        raise CompressError("Le fichier est protégé par mot de passe.")
    except Exception as e:
        raise CompressError(f"Compression échouée : {e}") from e

    new_size = out.stat().st_size

    if new_size >= original_size:
        out.write_bytes(src.read_bytes())
        new_size = original_size

    saved = original_size - new_size
    pct = (saved / original_size * 100) if original_size > 0 else 0

    return {
        "path": str(out),
        "filename": out.name,
        "original_size": original_size,
        "new_size": new_size,
        "saved_bytes": saved,
        "saved_percent": round(pct, 1),
        "level": level,
    }
