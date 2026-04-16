@echo off
title AVA Holographic Assistant
cd /d "%~dp0"

echo.
echo  =============================================
echo   AVA - Iniciando servidor...
echo  =============================================
echo.

:: Verificar Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Instala Node.js desde https://nodejs.org
    pause
    exit /b 1
)

:: Matar TODOS los procesos node (limpia cualquier servidor viejo)
echo  Limpiando procesos anteriores...
taskkill /IM node.exe /F >nul 2>&1
timeout /t 1 /nobreak >nul

:: Abrir browser automaticamente despues de 3 segundos
start "" /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3333"

:: Iniciar servidor
echo  Servidor iniciando en http://localhost:3333
echo  NO CIERRES ESTA VENTANA mientras uses AVA.
echo.
node server.js

echo.
echo  Servidor detenido.
pause
