@echo off
title HACIENDA - Suite Fiscal, Patrimonial i Trading
color 0B

echo =====================================================================
echo       INICIANT L'APLICACIO HACIENDA (PRO)
echo =====================================================================
echo.
echo Directori: %~dp0
cd /d "%~dp0"

echo [1/3] Verificant dependencies...
if not exist "node_modules" (
    echo Instal·lant dependencies de Node.js per primer cop...
    call npm install
) else (
    echo Dependencies llestes.
)

echo.
echo [2/3] Obrint el navegador a http://localhost:5173 ...
start http://localhost:5173

echo.
echo [3/3] Engegant el servidor de desenvolupament local...
echo (Pots tancar aquesta finestra quan acabis de fer servir l'aplicacio)
echo =====================================================================
echo.

call npm run dev
pause
