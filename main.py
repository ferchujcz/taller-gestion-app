
import uvicorn
import threading
import jwt
from fastapi.staticfiles import StaticFiles
from datetime import datetime, timedelta
from fastapi.security import OAuth2PasswordBearer
from backend.routes import vehiculos, ordenes, configuracion, finanzas, empleados, gestion, turnos
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.responses import FileResponse
from backend.database import engine
from backend.schemas import RegistroSaaS   # Trae el validador de datos[cite: 3]
from backend.models import Usuario, Taller # Trae las tablas de la base de datos[cite: 2]
from backend.database import get_db        # Trae el motor de conexión
from backend import models
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
# Importar librerías para hashear contraseñas (ej: passlib)
from passlib.context import CryptContext
from pydantic import BaseModel


# Claves para el Login
SECRET_KEY = "mi_clave_secreta_taller_360_super_segura"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 720
# Esta línea es mágica: crea todas las tablas en la base de datos si no existen
models.Base.metadata.create_all(bind=engine)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")



# 1. Inicializamos FastAPI
app = FastAPI(title="Sistema Taller Automotriz")
app.mount("/css", StaticFiles(directory="frontend/css"), name="css")
app.mount("/js", StaticFiles(directory="frontend/js"), name="js")
app.include_router(vehiculos.router, prefix="/api")
app.include_router(ordenes.router, prefix="/api")
app.include_router(finanzas.router, prefix="/api")
app.include_router(empleados.router, prefix="/api")
app.include_router(configuracion.router, prefix="/api/configuracion")
app.include_router(gestion.router, prefix="/api/gestion")
app.include_router(turnos.router, prefix="/api")
# Asumiendo que tenés tu función get_db
@app.post("/api/saas/registro", tags=["SaaS Admin"])
def registrar_nuevo_taller(datos: RegistroSaaS, db: Session = Depends(get_db)):
    # 1. Verificar que el email no exista ya
    usuario_existente = db.query(Usuario).filter(Usuario.email == datos.email_admin).first()
    if usuario_existente:
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    # 2. Crear el Taller
    nuevo_taller = Taller(
        nombre_fantasia=datos.nombre_taller,
        email_contacto=datos.email_admin,
        telefono=datos.telefono_taller,
        codigo_afiliado=datos.codigo_afiliado
    )
    db.add(nuevo_taller)
    db.commit()
    db.refresh(nuevo_taller)

    # 3. Crear el Usuario Admin para ese taller
    hash_pass = pwd_context.hash(datos.password_admin)
    nuevo_usuario = Usuario(
        email=datos.email_admin,
        password_hash=hash_pass,
        rol="admin",
        taller_id=nuevo_taller.id
    )
    db.add(nuevo_usuario)
    db.commit()

    return {"mensaje": "Taller creado exitosamente", "taller_id": nuevo_taller.id}

# Esquema para recibir los datos de ingreso
class LoginRequest(BaseModel):
    email: str
    password: str



oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

def crear_token_acceso(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire}) # Le inyectamos la fecha de vencimiento
    # Creamos el token sellado con tu firma secreta
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
@app.post("/api/login", tags=["Autenticación"])
def iniciar_sesion(datos: LoginRequest, db: Session = Depends(get_db)):
    # 1. Buscar al usuario
    usuario = db.query(Usuario).filter(Usuario.email == datos.email).first()
    
    # Por seguridad, si falla el correo o la clave, damos el mismo mensaje para no dar pistas a los hackers
    if not usuario or not pwd_context.verify(datos.password, usuario.password_hash):
        raise HTTPException(status_code=400, detail="Correo o contraseña incorrectos")
        
    # 2. Fabricar el Token Real
    datos_token = {
        "sub": usuario.email, 
        "taller_id": usuario.taller_id, 
        "rol": usuario.rol
    }
    token_real = crear_token_acceso(datos_token)
    
    # 3. Entregar las llaves
    return {
        "access_token": token_real, 
        "token_type": "bearer",
        "taller_id": usuario.taller_id,
        "rol": usuario.rol
    }

@app.get("/", response_class=FileResponse)
def leer_raiz():
    return "frontend/index.html"

@app.get("/login.html", response_class=FileResponse)
def mostrar_login():
    return "frontend/login.html"

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

