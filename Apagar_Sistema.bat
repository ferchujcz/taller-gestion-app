@echo off
echo Apagando el servidor del Taller...
taskkill /F /IM uvicorn.exe /T > NUL 2>&1
taskkill /F /IM ngrok.exe /T > NUL 2>&1
echo Sistema apagado correctamente.
timeout /t 3 > NUL