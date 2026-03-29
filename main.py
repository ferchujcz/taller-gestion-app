import webview
import uvicorn
import threading
from backend.routes import vehiculos, ordenes, configuracion, finanzas, empleados, gestion
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.responses import FileResponse
from backend.database import engine
from backend import models

# Esta línea es mágica: crea todas las tablas en la base de datos si no existen
models.Base.metadata.create_all(bind=engine)

# 1. Inicializamos FastAPI
app = FastAPI(title="Sistema Taller Automotriz")
app.include_router(vehiculos.router, prefix="/api")
app.include_router(ordenes.router, prefix="/api")
app.include_router(finanzas.router, prefix="/api")
app.include_router(empleados.router, prefix="/api")
app.include_router(configuracion.router, prefix="/api/configuracion")
app.include_router(gestion.router, prefix="/api/gestion")

@app.get("/", response_class=FileResponse)
def leer_raiz():
    return "frontend/index.html"

# NUEVA RUTA: Sirve la pantalla del celular para los mecánicos
@app.get("/box/{nombre_box}", response_class=FileResponse)
def pantalla_mecanico(nombre_box: str):
    return "frontend/box.html"

# 2. Función para levantar el servidor local en el puerto 8000
def iniciar_servidor():
    # host="0.0.0.0" permite que los celulares en el mismo Wi-Fi se conecten
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="error")

if __name__ == '__main__':
    # 3. Levantamos FastAPI en un hilo separado para que no bloquee la ventana
    hilo_servidor = threading.Thread(target=iniciar_servidor)
    hilo_servidor.daemon = True
    hilo_servidor.start()

    # 4. Creamos y abrimos la ventana nativa apuntando a nuestro servidor local
    # Puedes ajustar el tamaño (width, height) como prefieras
    ventana = webview.create_window(
        title='Gestión de Taller', 
        url='http://localhost:8000',
        width=1200, 
        height=800,
        min_size=(800, 600)
    )
    
