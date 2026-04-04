@echo off
echo ===================================================
echo   INICIANDO SISTEMA 3D RACER...
echo   Levantando el motor y la conexion segura...
echo ===================================================

:: 1. Prende el sistema de Python en segundo plano (minimizada)
start /MIN cmd /c "call venv\Scripts\activate && uvicorn main:app --port 8000"

:: 2. Espera 7 segundos reales a que cargue (Espacio corregido)
timeout /t 15 /nobreak > NUL

:: 3. Prende el túnel de Ngrok minimizado
:: (Asegurate de que el archivo ngrok.exe este copiado en esta misma carpeta)
start /MIN ngrok http --domain=unsalubrious-busiest-page.ngrok-free.dev 8000

:: 4. Le abre la pantalla al dueño en su PC
start chrome http://localhost:8000

:: 5. Cierra esta ventana negra principal para que no moleste
exit