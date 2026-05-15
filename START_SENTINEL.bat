@echo off
title UNBOUND SENTINEL - DASHBOARD
color 0b
echo ==========================================
echo    🛡️  UNBOUND SENTINEL - MASTER NODE
echo ==========================================
echo.
echo [1/2] Abrindo interface no navegador...
start http://localhost:3300
echo [2/2] Iniciando servidor Node.js...
echo.
node index.js
pause
 
