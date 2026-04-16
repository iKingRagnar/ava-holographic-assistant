@echo off
title AVA Holographic Server
cd /d "%~dp0"
echo.
echo  ============================================
echo   AVA - Iniciando servidor local...
echo  ============================================
echo.

:: Verificar si Node.js esta instalado
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js no esta instalado.
    echo  Descargalo de https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: Matar cualquier proceso en el puerto 3333
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3333 "') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo  Servidor iniciando en http://localhost:3333
echo  (Deja esta ventana abierta mientras usas AVA)
echo.

:: Iniciar el servidor
node server.js

echo.
echo  El servidor se detuvo.
pause
