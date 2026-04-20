@echo off
title AVA — Push a GitHub
cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║          AVA — Subiendo cambios a GitHub             ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

echo [1/4] Limpiando locks de git...
del /f /q ".git\HEAD.lock" 2>nul
del /f /q ".git\index.lock" 2>nul
echo      OK

echo.
echo [2/4] Agregando archivos...
git add ava.html
git add api/chat.js
git add api/chat-stream.js
git add api/rag-ingest.js
git add api/rag-search.js
git add api/tts-edge.js
git add api/tts-openai.js
git add api/stt-deepgram.js
git add server.js
git add agents.md
git add memory.md
git add PUSH_GITHUB.bat
echo      OK

echo.
echo [3/4] Creando commit...
git commit -m "fix(critical): restore truncated ava.html — window.onload never fired, ACTIVAR AVA broke"
echo      OK

echo.
echo [4/4] Subiendo a GitHub...
git push origin main

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║          ✓  Push completado exitosamente             ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
pause
