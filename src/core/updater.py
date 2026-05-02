"""
Auto-updater pour Le Studio PDF — recopie le pattern DéliNote (electron-updater)
en pur Python.

Flow :
    1. App demarre → check passif via GitHub Releases API
    2. Si une version plus recente existe → telechargement silencieux en arriere-plan
    3. Quand le download est fini → notif renderer (phase=ready)
    4. User clique "Installer" → on lance l installeur, l app quitte, le setup
       overwrite et relance la nouvelle version

Phases (identique a DéliNote) :
    idle | checking | available | not-available | downloading | ready | error
"""
from __future__ import annotations

import fnmatch
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Callable, Optional

from src.config import (
    APP_VERSION,
    GITHUB_OWNER,
    GITHUB_REPO,
    UPDATE_INSTALLER_PATTERN,
)


# =========================================================================
#  Comparaison de versions (sans dependance externe)
# =========================================================================

def parse_version(v: str) -> tuple[tuple[int, ...], str]:
    """'v2.7.1-beta.2' -> ((2, 7, 1), 'beta.2')"""
    v = (v or "0.0.0").lstrip("vV").strip()
    if "-" in v:
        main, pre = v.split("-", 1)
    else:
        main, pre = v, ""
    parts: list[int] = []
    for p in main.split("."):
        try:
            parts.append(int(p))
        except ValueError:
            parts.append(0)
    return tuple(parts), pre


def is_newer(latest: str, current: str) -> bool:
    l_parts, l_pre = parse_version(latest)
    c_parts, c_pre = parse_version(current)
    if l_parts > c_parts:
        return True
    if l_parts < c_parts:
        return False
    # main parts identiques : '' > '<prerelease>'
    if not l_pre and c_pre:
        return True
    if l_pre and not c_pre:
        return False
    return l_pre > c_pre


# =========================================================================
#  Etat du updater
# =========================================================================

@dataclass
class UpdateStatus:
    phase: str = "idle"             # idle|checking|available|not-available|downloading|ready|error
    current_version: str = APP_VERSION
    next_version: str = ""
    release_notes: str = ""
    percent: int = 0
    bytes_per_second: int = 0
    message: str = ""
    download_url: str = ""
    download_size: int = 0
    installer_path: str = ""
    is_prerelease: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


# =========================================================================
#  Updater singleton
# =========================================================================

class _Updater:
    def __init__(self) -> None:
        self.status = UpdateStatus(current_version=APP_VERSION)
        self._listeners: list[Callable[[UpdateStatus], None]] = []
        self._download_thread: Optional[threading.Thread] = None
        self._stop_download = threading.Event()
        self._channel = "stable"  # 'stable' | 'beta'

    def add_listener(self, cb: Callable[[UpdateStatus], None]) -> None:
        self._listeners.append(cb)

    def set_channel(self, channel: str) -> None:
        if channel in ("stable", "beta"):
            self._channel = channel

    def _broadcast(self) -> None:
        for cb in list(self._listeners):
            try:
                cb(self.status)
            except Exception:
                pass

    def _set(self, **kwargs) -> None:
        for k, v in kwargs.items():
            setattr(self.status, k, v)
        self._broadcast()

    # ---------- API publique ----------

    def check_for_updates(self, async_: bool = True) -> None:
        if self.status.phase in ("checking", "downloading"):
            return  # already busy
        if async_:
            threading.Thread(target=self._do_check, daemon=True).start()
        else:
            self._do_check()

    def install(self) -> bool:
        if self.status.phase != "ready" or not self.status.installer_path:
            return False
        installer = self.status.installer_path
        if not os.path.exists(installer):
            self._set(phase="error", message="Installeur introuvable apres telechargement.")
            return False
        try:
            # Lance l installeur silencieux, puis on quitte
            subprocess.Popen(
                [installer, "/SILENT", "/NORESTART"],
                creationflags=getattr(subprocess, "DETACHED_PROCESS", 0),
                close_fds=True,
            )
            # Donne le temps au process de demarrer puis quitte
            threading.Timer(1.5, lambda: os._exit(0)).start()
            return True
        except Exception as e:
            self._set(phase="error", message=f"Lancement installeur impossible : {e}")
            return False

    # ---------- Logique interne ----------

    def _api_url_latest(self) -> str:
        return f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/releases/latest"

    def _api_url_all(self) -> str:
        return f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/releases?per_page=10"

    def _http_json(self, url: str, timeout: float = 12.0) -> Optional[object]:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": f"LeStudioPDF/{APP_VERSION}",
                "Accept": "application/vnd.github+json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            raise
        except Exception:
            raise

    def _do_check(self) -> None:
        self._set(phase="checking", message="")
        try:
            if self._channel == "beta":
                releases = self._http_json(self._api_url_all())
                if not releases:
                    self._set(phase="not-available")
                    return
                # Premier release (plus recent), inclut pre-releases
                latest = releases[0]
            else:
                latest = self._http_json(self._api_url_latest())
                if not latest:
                    self._set(phase="not-available")
                    return

            tag = latest.get("tag_name", "")
            if not is_newer(tag, APP_VERSION):
                self._set(phase="not-available", next_version=tag)
                return

            # Cherche l asset installeur
            installer_asset = None
            for asset in latest.get("assets", []):
                name = asset.get("name", "")
                if fnmatch.fnmatch(name, UPDATE_INSTALLER_PATTERN):
                    installer_asset = asset
                    break

            if not installer_asset:
                self._set(
                    phase="error",
                    message=f"Aucun installeur trouve dans la release {tag}.",
                )
                return

            self._set(
                phase="available",
                next_version=tag.lstrip("v"),
                release_notes=latest.get("body", "") or "",
                download_url=installer_asset.get("browser_download_url", ""),
                download_size=installer_asset.get("size", 0),
                is_prerelease=bool(latest.get("prerelease", False)),
            )

            # Auto-download en arriere-plan
            self._start_download()
        except Exception as e:
            self._set(phase="error", message=f"Verification echouee : {e}")

    def _start_download(self) -> None:
        if self._download_thread and self._download_thread.is_alive():
            return
        self._stop_download.clear()
        self._download_thread = threading.Thread(target=self._do_download, daemon=True)
        self._download_thread.start()

    def _do_download(self) -> None:
        url = self.status.download_url
        if not url:
            self._set(phase="error", message="URL de telechargement manquante.")
            return

        self._set(phase="downloading", percent=0, bytes_per_second=0)

        tmp_dir = Path(tempfile.gettempdir()) / "LeStudioPDF_updates"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        # Nom du fichier base sur la derniere version
        target = tmp_dir / f"LeStudioPDF_setup_{self.status.next_version}.exe"

        try:
            req = urllib.request.Request(url, headers={"User-Agent": f"LeStudioPDF/{APP_VERSION}"})
            with urllib.request.urlopen(req, timeout=30) as r:
                total = int(r.headers.get("Content-Length", "0") or "0") or self.status.download_size or 0
                downloaded = 0
                start = time.time()
                last_broadcast = 0.0

                with open(target, "wb") as f:
                    while True:
                        if self._stop_download.is_set():
                            self._set(phase="error", message="Telechargement annule.")
                            return
                        chunk = r.read(64 * 1024)
                        if not chunk:
                            break
                        f.write(chunk)
                        downloaded += len(chunk)

                        now = time.time()
                        if now - last_broadcast >= 0.4 or downloaded == total:
                            elapsed = max(0.001, now - start)
                            bps = int(downloaded / elapsed)
                            pct = int(downloaded * 100 / total) if total else 0
                            self._set(
                                phase="downloading",
                                percent=pct,
                                bytes_per_second=bps,
                            )
                            last_broadcast = now

            self._set(
                phase="ready",
                installer_path=str(target),
                percent=100,
            )
        except Exception as e:
            self._set(phase="error", message=f"Telechargement echoue : {e}")


# Singleton global
updater = _Updater()
