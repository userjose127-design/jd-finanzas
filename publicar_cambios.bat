@echo off
title Publicar Cambios - JD Finanzas
cls
echo ===================================================
echo        PUBLICAR ACTUALIZACIONES EN GITHUB
echo ===================================================
echo.
echo 1. Agregando archivos modificados...
git add .
echo.
set /p mensaje="Descripcion del cambio (o presiona ENTER para continuar): "
if "%mensaje%"=="" set mensaje=Actualizacion de JD Finanzas
echo.
echo 2. Creando punto de guardado...
git commit -m "%mensaje%"
echo.
echo 3. Subiendo cambios a GitHub...
git push origin main
echo.
echo ===================================================
echo   Proceso finalizado.
echo   Tus cambios se actualizaran en tu app en 1 minuto.
echo ===================================================
pause
