@echo off
echo ===================================================
echo   CONFIGURANDO RED LOCAL PARA CELULARES (3D RACER)
echo ===================================================
echo Abriendo puerto 8000 en el Firewall de Windows...
netsh advfirewall firewall add rule name="Taller 3D Racer (Puerto 8000)" dir=in action=allow protocol=TCP localport=8000
echo.
echo ¡Listo! Los celulares ahora pueden conectarse a la IP de esta PC.
pause