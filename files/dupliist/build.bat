@echo off
REM ============================================================
REM   Spotify YT Aero - Build script para Windows (.exe)
REM   Genera un único archivo SpotifyYTConverter.exe en dist\
REM ============================================================

echo.
echo ==========================================================
echo  Construyendo SpotifyYTConverter.exe ...
echo ==========================================================
echo.

REM 1) Asegurar dependencias
echo [1/3] Instalando dependencias...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo ERROR: No se pudieron instalar las dependencias.
    echo Asegurate de tener Python 3.10+ instalado y en el PATH.
    pause
    exit /b 1
)

REM 2) Limpiar builds anteriores
echo.
echo [2/3] Limpiando builds anteriores...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist SpotifyYTConverter.spec del /q SpotifyYTConverter.spec

REM 3) Empaquetar con PyInstaller
echo.
echo [3/3] Empaquetando con PyInstaller (esto puede tardar 1-2 min)...
python -m PyInstaller ^
    --onefile ^
    --noconsole ^
    --name "SpotifyYTConverter" ^
    --add-data "credits.png;." ^
    --add-data "aero_assets.py;." ^
    --add-data "splash.py;." ^
    --hidden-import customtkinter ^
    --hidden-import PIL ^
    --hidden-import PIL._tkinter_finder ^
    --collect-all customtkinter ^
    main.py

if errorlevel 1 (
    echo.
    echo ERROR: PyInstaller fallo. Revisa los mensajes arriba.
    pause
    exit /b 1
)

echo.
echo ==========================================================
echo  LISTO! Tu .exe esta en:  dist\SpotifyYTConverter.exe
echo ==========================================================
echo.
echo  IMPORTANTE: Necesitas FFmpeg instalado en el PATH para
echo  que la descarga de MP3 funcione. Descargalo de:
echo    https://www.gyan.dev/ffmpeg/builds/
echo.
pause
