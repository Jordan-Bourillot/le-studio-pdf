from pathlib import Path
from typing import Optional

import pikepdf


class ProtectError(Exception):
    pass


def protect_pdf(
    input_path: str,
    output_path: str,
    user_password: str,
    owner_password: Optional[str] = None,
    allow_printing: bool = True,
    allow_copying: bool = True,
    allow_modifying: bool = False,
) -> dict:
    src = Path(input_path)
    if not src.exists():
        raise ProtectError(f"Fichier introuvable : {src.name}")
    if src.suffix.lower() != ".pdf":
        raise ProtectError("Pas un fichier PDF.")
    if not user_password:
        raise ProtectError("Le mot de passe est obligatoire.")

    out = Path(output_path)
    if out.suffix.lower() != ".pdf":
        out = out.with_suffix(".pdf")
    out.parent.mkdir(parents=True, exist_ok=True)

    if not owner_password:
        owner_password = user_password

    perms = pikepdf.Permissions(
        accessibility=True,
        extract=allow_copying,
        modify_annotation=allow_modifying,
        modify_assembly=allow_modifying,
        modify_form=allow_modifying,
        modify_other=allow_modifying,
        print_lowres=allow_printing,
        print_highres=allow_printing,
    )

    try:
        with pikepdf.open(str(src)) as pdf:
            if pdf.is_encrypted:
                raise ProtectError("Ce PDF est déjà protégé. Retirez sa protection avant d'en ajouter une nouvelle.")
            pdf.save(
                str(out),
                encryption=pikepdf.Encryption(
                    owner=owner_password,
                    user=user_password,
                    R=6,
                    allow=perms,
                ),
            )
    except ProtectError:
        raise
    except pikepdf.PasswordError:
        raise ProtectError("PDF illisible (déjà protégé ?).")
    except Exception as e:
        raise ProtectError(f"Protection échouée : {e}") from e

    return {
        "path": str(out),
        "filename": out.name,
        "size_bytes": out.stat().st_size,
        "allow_printing": allow_printing,
        "allow_copying": allow_copying,
        "allow_modifying": allow_modifying,
    }
