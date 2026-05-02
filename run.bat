@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

REM --- Detection d une installation Python valide ---
REM On prefere les versions stables (3.12, 3.13, 3.11, 3.10) avant la derniere.

py -3.12 -c "import pip, venv" >nul 2>nul
if not errorlevel 1 (
    set "PYCMD=py -3.12"
    goto :pyfound
)

py -3.13 -c "import pip, venv" >nul 2>nul
if not errorlevel 1 (
    set "PYCMD=py -3.13"
    goto :pyfound
)

py -3.11 -c "import pip, venv" >nul 2>nul
if not errorlevel 1 (
    set "PYCMD=py -3.11"
    goto :pyfound
)

py -3.10 -c "import pip, venv" >nul 2>nul
if not errorlevel 1 (
    set "PYCMD=py -3.10"
    goto :pyfound
)

py -3 -c "import pip, venv" >nul 2>nul
if not errorlevel 1 (
    set "PYCMD=py -3"
    goto :pyfound
)

python -c "import pip, venv" >nul 2>nul
if not errorlevel 1 (
    set "PYCMD=python"
    goto :pyfound
)

echo.
echo [ERREUR] Aucune installation Python complete trouvee.
echo Telecharge Python 3.12 sur https://www.python.org/downloads/release/python-3128/
echo et coche "Add Python to PATH" + "py launcher".
pause
exit /b 1

:pyfound
echo Python detecte : !PYCMD!

REM --- Verifie si le .venv existant correspond au Python courant ---
set "MARKER=.venv\.pycmd_marker"
set "RECREATE=0"

if exist .venv (
    if not exist .venv\Scripts\python.exe set "RECREATE=1"
)

if exist .venv\Scripts\python.exe (
    .venv\Scripts\python.exe -c "import sys" >nul 2>nul
    if errorlevel 1 set "RECREATE=1"
)

if exist .venv if not exist "!MARKER!" set "RECREATE=1"

if exist "!MARKER!" (
    set "STORED="
    for /f "usebackq delims=" %%L in ("!MARKER!") do set "STORED=%%L"
    if not "!STORED!"=="!PYCMD!" (
        echo Python a change : !STORED! -^> !PYCMD!
        set "RECREATE=1"
    )
)

if "!RECREATE!"=="1" (
    if exist .venv (
        echo Suppression de l ancien environnement virtuel...
        rmdir /s /q .venv
    )
)

if not exist .venv (
    echo Creation de l environnement virtuel avec !PYCMD!...
    !PYCMD! -m venv --copies .venv
    if errorlevel 1 (
        echo [ERREUR] Impossible de creer l environnement virtuel.
        pause
        exit /b 1
    )
    >"!MARKER!" echo !PYCMD!
)

call .venv\Scripts\activate.bat

python -c "import sys" >nul 2>nul
if errorlevel 1 (
    echo [ERREUR] L environnement virtuel ne repond pas.
    echo Cause probable : Avast / Defender bloque python.exe.
    echo Solution : whiteliste %~dp0.venv dans ton antivirus.
    pause
    exit /b 1
)

REM --- Verifie si les dependances doivent etre (re)installees ---
set "NEED_INSTALL=0"

python -c "import webview, pypdf, pikepdf, PIL" 2>nul
if errorlevel 1 set "NEED_INSTALL=1"

python -c "import os, sys; m=r'.venv\.req_marker'; r=r'requirements.txt'; sys.exit(0 if os.path.exists(m) and os.path.getmtime(m) >= os.path.getmtime(r) else 1)" 2>nul
if errorlevel 1 set "NEED_INSTALL=1"

if "!NEED_INSTALL!"=="1" (
    echo Installation / mise a jour des dependances...
    python -m pip install --upgrade pip
    if errorlevel 1 (
        echo [ERREUR] Mise a jour de pip echouee.
        pause
        exit /b 1
    )
    pip install -r requirements.txt
    if errorlevel 1 (
        echo.
        echo [ERREUR] Installation des dependances echouee.
        pause
        exit /b 1
    )
    python -c "open(r'.venv\.req_marker', 'w').close()"
)

python -m src.app
if errorlevel 1 (
    echo.
    echo [ERREUR] L application a quitte avec une erreur.
    pause
)
