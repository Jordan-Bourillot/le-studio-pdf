@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo  Le Studio PDF — construction de l installeur Windows
echo ============================================================

REM ---- Verifie que le .exe est deja construit ----
if not exist "dist\LeStudioPDF\LeStudioPDF.exe" (
    echo.
    echo [ERREUR] dist\LeStudioPDF\LeStudioPDF.exe est introuvable.
    echo Lance d abord build.bat pour construire l executable.
    pause
    exit /b 1
)

REM ---- Localise Inno Setup compiler (ISCC.exe) ----
set "ISCC="
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set "ISCC=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if exist "C:\Program Files\Inno Setup 6\ISCC.exe" set "ISCC=C:\Program Files\Inno Setup 6\ISCC.exe"

if "%ISCC%"=="" (
    echo.
    echo [ERREUR] Inno Setup 6 n est pas installe.
    echo.
    echo Telecharge-le ici : https://jrsoftware.org/isdl.php
    echo Choisis la version standard ^(unicode^), francaise.
    echo Puis relance ce script.
    pause
    exit /b 1
)

echo Inno Setup detecte : %ISCC%

REM ---- Compile l installeur ----
if not exist installer_output mkdir installer_output

echo.
echo Compilation de l installeur ^(1-2 min^)...
echo.

"%ISCC%" /Qp installer\studio_pdf.iss
if errorlevel 1 (
    echo.
    echo [ERREUR] Compilation echouee.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  TERMINE
echo ============================================================
echo  Installeur : installer_output\LeStudioPDF_setup_2.7.0.exe
echo.
dir installer_output\*.exe 2>nul
echo.
echo  Distribue ce setup.exe a tes utilisateurs : ils auront un
echo  vrai assistant d installation avec ^(entre autres^) la case
echo  "Creer un raccourci sur le bureau".
echo ============================================================
pause
