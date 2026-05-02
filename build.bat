@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo  Le Studio PDF — construction de l executable Windows
echo ============================================================

REM Detection Python (idem run.bat)
py -3.12 -c "import pip, venv" >nul 2>nul
if not errorlevel 1 ( set "PYCMD=py -3.12" & goto :pyfound )
py -3.13 -c "import pip, venv" >nul 2>nul
if not errorlevel 1 ( set "PYCMD=py -3.13" & goto :pyfound )
py -3.11 -c "import pip, venv" >nul 2>nul
if not errorlevel 1 ( set "PYCMD=py -3.11" & goto :pyfound )
py -3 -c "import pip, venv" >nul 2>nul
if not errorlevel 1 ( set "PYCMD=py -3" & goto :pyfound )
echo [ERREUR] Aucun Python complet trouve.
pause
exit /b 1

:pyfound
echo Python : !PYCMD!

REM Active le venv (cree par run.bat)
if not exist .venv\Scripts\python.exe (
    echo [ERREUR] Lance d abord run.bat une fois pour creer le .venv.
    pause
    exit /b 1
)
call .venv\Scripts\activate.bat

REM Installe pyinstaller si manquant
python -c "import PyInstaller" 2>nul
if errorlevel 1 (
    echo Installation de PyInstaller...
    pip install -r requirements-build.txt
    if errorlevel 1 (
        echo [ERREUR] Installation echouee.
        pause
        exit /b 1
    )
)

REM Genere l icone .ico depuis bertrand_logo.png
echo Generation de l icone Bertrand...
python tools\make_icon.py
if errorlevel 1 (
    echo [ERREUR] Generation icone echouee.
    pause
    exit /b 1
)

REM Nettoie l ancien build
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist

REM Lance PyInstaller
echo.
echo Construction en cours ^(2-5 min selon la machine^)...
echo.
pyinstaller studio_pdf.spec --noconfirm
if errorlevel 1 (
    echo [ERREUR] PyInstaller a echoue.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  TERMINE
echo ============================================================
echo  Executable : dist\LeStudioPDF\LeStudioPDF.exe
echo  Taille du dossier dist\LeStudioPDF :
dir /s "dist\LeStudioPDF" | find "fichier(s)"
echo.
echo  Pour distribuer : zippez le dossier dist\LeStudioPDF\
echo ============================================================
pause
