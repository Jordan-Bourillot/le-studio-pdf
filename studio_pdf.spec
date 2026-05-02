# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec pour Le Studio PDF.

Construction :
    pyinstaller studio_pdf.spec --noconfirm
Sortie :
    dist/LeStudioPDF/LeStudioPDF.exe
"""
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Ressources a embarquer (UI complete + schema SQL)
datas = [
    ("ui", "ui"),
    ("src/db/schema.sql", "src/db"),
]

# Donnees natives des libs PDF (DLL, fichiers de police, etc.)
for pkg in ("pikepdf", "pdf2docx", "reportlab", "pypdfium2", "ocrmypdf"):
    try:
        datas += collect_data_files(pkg)
    except Exception:
        pass

# Imports caches (pour eviter les ModuleNotFoundError au runtime)
hiddenimports = [
    "pikepdf",
    "pikepdf._core",
    "pdf2docx",
    "pypdfium2",
    "reportlab.pdfgen",
    "reportlab.lib.colors",
    "ocrmypdf",
    "PIL",
    "PIL.Image",
    "pypdf",
    "webview",
    "sqlite3",
]
for pkg in ("pikepdf", "pdf2docx", "reportlab"):
    try:
        hiddenimports += collect_submodules(pkg)
    except Exception:
        pass

a = Analysis(
    ["src/app.py"],
    pathex=["."],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter", "pytest", "matplotlib", "scipy", "numpy.testing"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="LeStudioPDF",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon="ui/assets/bertrand.ico",
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="LeStudioPDF",
)
