Set WshShell = CreateObject("WScript.Shell")

' 1. Arranca Python habilitando la red local (--host 0.0.0.0) de forma totalmente invisible (0)
WshShell.Run "cmd /c call venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8000", 0, False

' 2. Espera 15 segundos
WScript.Sleep 15000

' 3. Arranca Ngrok de forma totalmente invisible (0)
WshShell.Run "cmd /c ngrok http --domain=unsalubrious-busiest-page.ngrok-free.dev 8000", 0, False

' 4. Abre el navegador web al dueño
WshShell.Run "cmd /c start chrome http://localhost:8000", 0, False