
@echo off
echo ===================================================
echo   INICIANDO SISTEMA DE GESTION - TALLER
echo   Por favor, NO CIERRE esta ventana negra.
echo   Si la cierra, el sistema dejara de funcionar.
echo ===================================================
call venv\Scripts\activate
start /MIN cmd /c "uvicorn main:app --host 0.0.0.0 --port 8000"
timeout /t 4 /nobreak > NUL
start http://localhost:8000