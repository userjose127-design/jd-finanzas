@echo off
title JD Finanzas - Servidor Local
cls
echo ===================================================
echo          JD FINANZAS - CONTROL & CUOTAS
echo ===================================================
echo.
echo Iniciando servidor local...
echo Tu direccion local en la PC: http://localhost:8080
echo Tu direccion para el movil (en la misma red Wi-Fi): http://10.10.14.25:8080
echo.
echo Presiona Ctrl+C para detener el servidor cuando termines.
echo ===================================================
start http://localhost:8080
python -m http.server 8080
pause
