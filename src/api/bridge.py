import base64
import os
import subprocess
import sys
from pathlib import Path

import webview

from src.config import DATA_DIR
from src.core.pdf_engine import inspect, InvalidPDFError
from src.core.merge import merge_pdfs as _merge_pdfs, MergeError
from src.core.compress import compress_pdf as _compress_pdf, CompressError
from src.core.protect import protect_pdf as _protect_pdf, ProtectError
from src.core.split import split_pdf as _split_pdf, SplitError
from src.core.watermark import (
    add_text_watermark as _add_watermark,
    add_page_numbers as _add_numbers,
    WatermarkError,
)
from src.core.convert import (
    convert_to_word as _convert_word,
    convert_to_images as _convert_images,
    ConvertError,
)
from src.core.ocr import (
    run_ocr as _run_ocr,
    check_deps as _check_ocr_deps,
    OcrError,
    OcrMissingDeps,
)
from src.core.stamp import add_stamp as _add_stamp, StampError
from src.db import repository as repo


class Bridge:
    def __init__(self) -> None:
        self._window = None

    def set_window(self, window) -> None:
        self._window = window

    def attach_updater_listener(self) -> None:
        """Push automatiquement les changements d etat updater vers le JS."""
        from src.core.updater import updater
        updater.add_listener(self._on_updater_status)

    def _on_updater_status(self, status) -> None:
        if not self._window:
            return
        try:
            import json as _json
            payload = _json.dumps(status.to_dict())
            self._window.evaluate_js(
                f"window.onUpdaterStatus && window.onUpdaterStatus({payload})"
            )
        except Exception:
            pass

    # --- État global ---

    def get_state(self) -> dict:
        return {
            "license": repo.get_license_status(),
            "recent": repo.list_recent(),
        }

    def get_recent(self) -> list[dict]:
        return repo.list_recent()

    def remove_recent(self, path: str) -> bool:
        repo.remove_recent(path)
        return True

    # --- Auto-updater (DéliNote-style) ---

    def updater_status(self) -> dict:
        from src.core.updater import updater
        return updater.status.to_dict()

    def updater_check(self, channel: str = "") -> bool:
        from src.core.updater import updater
        if channel in ("stable", "beta"):
            updater.set_channel(channel)
        updater.check_for_updates(async_=True)
        return True

    def updater_install(self) -> bool:
        from src.core.updater import updater
        return updater.install()

    def updater_set_channel(self, channel: str) -> bool:
        from src.core.updater import updater
        updater.set_channel(channel)
        repo.set_preference("update_channel", channel)
        return True

    # --- Beta lifecycle ---

    def beta_status(self) -> dict:
        from src.core.beta import get_beta_status
        return get_beta_status()

    def get_default_output_dir(self) -> str:
        docs = Path.home() / "Documents"
        if docs.exists():
            return str(docs)
        return str(Path.home())

    # --- Preferences ---

    def get_prefs(self) -> dict:
        return repo.get_all_preferences()

    def set_pref(self, key: str, value: str) -> bool:
        repo.set_preference(key, value)
        return True

    def clear_recents(self) -> bool:
        repo.clear_recents()
        return True

    def open_data_folder(self) -> bool:
        return self.open_file(str(DATA_DIR))

    # --- Hub : ouverture d'un PDF unique ---

    def open_file_dialog(self) -> dict | None:
        if not self._window:
            return None
        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=False,
            file_types=("Fichiers PDF (*.pdf)", "Tous les fichiers (*.*)"),
        )
        if not result:
            return None
        return self.inspect_file(result[0])

    def inspect_file(self, path: str) -> dict:
        try:
            info = inspect(path)
            if not info["encrypted"]:
                repo.add_recent(info["path"], info["filename"], info["page_count"])
            return {"ok": True, "info": info}
        except InvalidPDFError as e:
            return {"ok": False, "error": str(e)}

    def inspect_dropped(self, filename: str, data_base64: str) -> dict:
        target = self._save_dropped(filename, data_base64)
        if isinstance(target, dict):
            return target
        return self.inspect_file(str(target))

    # --- Module Fusionner ---

    def add_files_to_merge(self) -> list[dict]:
        if not self._window:
            return []
        result = self._window.create_file_dialog(
            webview.OPEN_DIALOG,
            allow_multiple=True,
            file_types=("Fichiers PDF (*.pdf)", "Tous les fichiers (*.*)"),
        )
        if not result:
            return []
        out = []
        for path in result:
            try:
                info = inspect(path)
                if info["encrypted"]:
                    continue
                out.append(info)
            except InvalidPDFError:
                continue
        return out

    def import_pdf_for_merge(self, filename: str, data_base64: str) -> dict:
        target = self._save_dropped(filename, data_base64)
        if isinstance(target, dict):
            return target
        try:
            info = inspect(str(target))
            if info["encrypted"]:
                return {"ok": False, "error": f"{info['filename']} est protégé par mot de passe."}
            return {"ok": True, "info": info}
        except InvalidPDFError as e:
            return {"ok": False, "error": str(e)}

    def pick_output_folder(self) -> str | None:
        if not self._window:
            return None
        result = self._window.create_file_dialog(webview.FOLDER_DIALOG)
        if result:
            return result[0]
        return None

    def merge_pdfs(self, paths: list[str], output_dir: str, output_name: str) -> dict:
        if not output_name:
            output_name = "fusion.pdf"
        if not output_name.lower().endswith(".pdf"):
            output_name = output_name + ".pdf"
        output_path = str(Path(output_dir) / output_name)
        try:
            info = _merge_pdfs(paths, output_path)
            repo.add_recent(info["path"], info["filename"], info["page_count"], action="fusionné")
            return {"ok": True, "info": info}
        except MergeError as e:
            return {"ok": False, "error": str(e)}
        except Exception as e:
            return {"ok": False, "error": f"Erreur inattendue : {e}"}

    # --- Module Compresser ---

    def compress_pdf(self, input_path: str, output_dir: str, output_name: str, level: str) -> dict:
        if not output_name:
            output_name = "fichier_compresse.pdf"
        if not output_name.lower().endswith(".pdf"):
            output_name = output_name + ".pdf"
        output_path = str(Path(output_dir) / output_name)

        try:
            orig = inspect(input_path)
            pages = orig.get("page_count", 0) or 0
        except InvalidPDFError:
            pages = 0

        if level not in ("mail", "web", "archive"):
            level = "web"

        try:
            info = _compress_pdf(input_path, output_path, level)
            repo.add_recent(info["path"], info["filename"], pages, action="compressé")
            return {"ok": True, "info": info}
        except CompressError as e:
            return {"ok": False, "error": str(e)}
        except Exception as e:
            return {"ok": False, "error": f"Erreur inattendue : {e}"}

    # --- Module Annoter (tampons) ---

    def add_stamp(self, input_path: str, output_dir: str, output_name: str,
                  text: str, position: str, color: str, pages_spec: str) -> dict:
        if not output_name:
            output_name = "tamponne.pdf"
        if not output_name.lower().endswith(".pdf"):
            output_name = output_name + ".pdf"
        output_path = str(Path(output_dir) / output_name)

        try:
            orig = inspect(input_path)
            pages = orig.get("page_count", 0) or 0
        except InvalidPDFError:
            pages = 0

        try:
            info = _add_stamp(input_path, output_path, text, position, color, pages_spec)
            repo.add_recent(info["path"], info["filename"], pages, action="tamponné")
            return {"ok": True, "info": info}
        except StampError as e:
            return {"ok": False, "error": str(e)}
        except Exception as e:
            return {"ok": False, "error": f"Erreur inattendue : {e}"}

    # --- Module OCR ---

    def check_ocr_deps(self) -> dict:
        return _check_ocr_deps()

    def run_ocr(self, input_path: str, output_dir: str, output_name: str, language: str) -> dict:
        if not output_name:
            output_name = "ocr.pdf"
        if not output_name.lower().endswith(".pdf"):
            output_name = output_name + ".pdf"
        output_path = str(Path(output_dir) / output_name)

        try:
            orig = inspect(input_path)
            pages = orig.get("page_count", 0) or 0
        except InvalidPDFError:
            pages = 0

        try:
            info = _run_ocr(input_path, output_path, language or "fra")
            repo.add_recent(info["path"], info["filename"], pages, action="OCR")
            return {"ok": True, "info": info}
        except OcrMissingDeps as e:
            return {"ok": False, "error": str(e), "missing_deps": True}
        except OcrError as e:
            return {"ok": False, "error": str(e)}
        except Exception as e:
            return {"ok": False, "error": f"Erreur inattendue : {e}"}

    # --- Module Convertir ---

    def convert_to_word(self, input_path: str, output_dir: str, output_name: str) -> dict:
        if not output_name:
            output_name = "converti.docx"
        if not output_name.lower().endswith(".docx"):
            output_name = output_name + ".docx"
        output_path = str(Path(output_dir) / output_name)

        try:
            orig = inspect(input_path)
            pages = orig.get("page_count", 0) or 0
        except InvalidPDFError:
            pages = 0

        try:
            info = _convert_word(input_path, output_path)
            repo.add_recent(info["path"], info["filename"], pages, action="converti")
            return {"ok": True, "info": info}
        except ConvertError as e:
            return {"ok": False, "error": str(e)}
        except Exception as e:
            return {"ok": False, "error": f"Erreur inattendue : {e}"}

    def convert_to_images(self, input_path: str, output_dir: str, fmt: str, dpi: int) -> dict:
        try:
            info = _convert_images(input_path, output_dir, fmt, int(dpi))
            return {"ok": True, "info": info}
        except ConvertError as e:
            return {"ok": False, "error": str(e)}
        except Exception as e:
            return {"ok": False, "error": f"Erreur inattendue : {e}"}

    # --- Module Filigrane / Numérotation ---

    def add_text_watermark(self, input_path: str, output_dir: str, output_name: str,
                           text: str, opacity: float) -> dict:
        if not output_name:
            output_name = "filigrane.pdf"
        if not output_name.lower().endswith(".pdf"):
            output_name = output_name + ".pdf"
        output_path = str(Path(output_dir) / output_name)
        try:
            info = _add_watermark(input_path, output_path, text, float(opacity))
            repo.add_recent(info["path"], info["filename"], info["page_count"], action="filigrané")
            return {"ok": True, "info": info}
        except WatermarkError as e:
            return {"ok": False, "error": str(e)}
        except Exception as e:
            return {"ok": False, "error": f"Erreur inattendue : {e}"}

    def add_page_numbers(self, input_path: str, output_dir: str, output_name: str,
                         position: str, fmt: str, start_at: int) -> dict:
        if not output_name:
            output_name = "numerote.pdf"
        if not output_name.lower().endswith(".pdf"):
            output_name = output_name + ".pdf"
        output_path = str(Path(output_dir) / output_name)
        try:
            info = _add_numbers(input_path, output_path, position, fmt, int(start_at))
            repo.add_recent(info["path"], info["filename"], info["page_count"], action="numéroté")
            return {"ok": True, "info": info}
        except WatermarkError as e:
            return {"ok": False, "error": str(e)}
        except Exception as e:
            return {"ok": False, "error": f"Erreur inattendue : {e}"}

    # --- Module Découper ---

    def split_pdf(self, input_path: str, output_dir: str, output_name: str, ranges_spec: str) -> dict:
        if not output_name:
            output_name = "extrait.pdf"
        if not output_name.lower().endswith(".pdf"):
            output_name = output_name + ".pdf"
        output_path = str(Path(output_dir) / output_name)

        try:
            info = _split_pdf(input_path, output_path, ranges_spec)
            repo.add_recent(info["path"], info["filename"], info["page_count"], action="découpé")
            return {"ok": True, "info": info}
        except SplitError as e:
            return {"ok": False, "error": str(e)}
        except Exception as e:
            return {"ok": False, "error": f"Erreur inattendue : {e}"}

    # --- Module Protéger ---

    def protect_pdf(self, input_path: str, output_dir: str, output_name: str,
                    password: str, options: dict) -> dict:
        if not password:
            return {"ok": False, "error": "Le mot de passe est obligatoire."}
        if not output_name:
            output_name = "fichier_protege.pdf"
        if not output_name.lower().endswith(".pdf"):
            output_name = output_name + ".pdf"
        output_path = str(Path(output_dir) / output_name)

        try:
            orig = inspect(input_path)
            pages = orig.get("page_count", 0) or 0
        except InvalidPDFError:
            pages = 0

        opts = options or {}
        try:
            info = _protect_pdf(
                input_path,
                output_path,
                user_password=password,
                allow_printing=bool(opts.get("allow_printing", True)),
                allow_copying=bool(opts.get("allow_copying", True)),
                allow_modifying=bool(opts.get("allow_modifying", False)),
            )
            repo.add_recent(info["path"], info["filename"], pages, action="protégé")
            return {"ok": True, "info": info}
        except ProtectError as e:
            return {"ok": False, "error": str(e)}
        except Exception as e:
            return {"ok": False, "error": f"Erreur inattendue : {e}"}

    # --- Ouverture système ---

    def open_url(self, url: str) -> bool:
        if not url:
            return False
        try:
            if sys.platform == "win32":
                os.startfile(url)
            elif sys.platform == "darwin":
                subprocess.Popen(["open", url])
            else:
                subprocess.Popen(["xdg-open", url])
            return True
        except Exception:
            try:
                import webbrowser
                return webbrowser.open(url)
            except Exception:
                return False

    def open_file(self, path: str) -> bool:
        p = Path(path)
        if not p.exists():
            return False
        try:
            if sys.platform == "win32":
                os.startfile(str(p))
            elif sys.platform == "darwin":
                subprocess.Popen(["open", str(p)])
            else:
                subprocess.Popen(["xdg-open", str(p)])
            return True
        except Exception:
            return False

    def open_in_explorer(self, path: str) -> bool:
        p = Path(path)
        if not p.exists():
            return False
        try:
            if sys.platform == "win32":
                subprocess.Popen(f'explorer /select,"{p}"')
            elif sys.platform == "darwin":
                subprocess.Popen(["open", "-R", str(p)])
            else:
                subprocess.Popen(["xdg-open", str(p.parent)])
            return True
        except Exception:
            return False

    # --- Helpers ---

    def _save_dropped(self, filename: str, data_base64: str):
        try:
            data = base64.b64decode(data_base64)
        except Exception as e:
            return {"ok": False, "error": f"Données illisibles ({e})"}
        imports_dir = DATA_DIR / "imports"
        imports_dir.mkdir(parents=True, exist_ok=True)
        safe_name = Path(filename).name or "document.pdf"
        target = imports_dir / safe_name
        try:
            target.write_bytes(data)
        except OSError as e:
            return {"ok": False, "error": f"Écriture impossible ({e})"}
        return target
