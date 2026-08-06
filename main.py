import os
import jwt
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import HTMLResponse, FileResponse
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from pydantic import BaseModel

# Importaciones de tu backend
from backend.database import engine, get_db
from backend import models
from backend.schemas import RegistroSaaS
from backend.models import Usuario, Taller, TallerConfig
from backend.routes import vehiculos, ordenes, configuracion, finanzas, empleados, gestion, turnos

# ==========================================
# CONFIGURACIÓN DE SEGURIDAD
# ==========================================
SECRET_KEY = "mi_clave_secreta_taller_360_super_segura"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 720
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# LLAVE MAESTRA PARA REGISTRO (El candado para Swagger)
LLAVE_MAESTRA_SAAS = os.getenv("LLAVE_MAESTRA", "talleressaasfm")

def verificar_llave_maestra(x_api_key: str = Header(...)):
    if x_api_key != LLAVE_MAESTRA_SAAS:
        raise HTTPException(status_code=403, detail="Acceso denegado. Solo el fundador puede crear talleres.")

# ==========================================
# INICIALIZACIÓN DE LA APLICACIÓN
# ==========================================
# ESCONDEMOS EL PANEL DE CONTROL PUBLICO
app = FastAPI(
    title="Sistema Taller Automotriz SaaS",
    docs_url="/docs-privados-founder", 
    redoc_url=None 
)

# CREAR TABLAS EN LA NUBE (Soluciona el Error 500)
models.Base.metadata.create_all(bind=engine)

# ==========================================
# ARCHIVOS ESTÁTICOS Y RUTAS
# ==========================================
app.mount("/css", StaticFiles(directory="frontend/css"), name="css")
app.mount("/js", StaticFiles(directory="frontend/js"), name="js")

app.include_router(vehiculos.router, prefix="/api")
app.include_router(ordenes.router, prefix="/api")
app.include_router(finanzas.router, prefix="/api")
app.include_router(empleados.router, prefix="/api")
app.include_router(configuracion.router, prefix="/api/configuracion")
app.include_router(gestion.router, prefix="/api/gestion")
app.include_router(turnos.router, prefix="/api")

# ==========================================
# RUTA DE REGISTRO (BLINDADA)
# ==========================================
@app.post("/api/saas/registro", tags=["SaaS Admin"])
def registrar_nuevo_taller(datos: RegistroSaaS, db: Session = Depends(get_db), llave: str = Depends(verificar_llave_maestra)):
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

    # 4. Crear la configuración inicial del taller
    config_inicial = TallerConfig(
        taller_id=nuevo_taller.id,
        nombre_taller=datos.nombre_taller,
        email=datos.email_admin,
        telefono=datos.telefono_taller
    )
    db.add(config_inicial)

    db.commit()

    return {"mensaje": "Taller creado exitosamente", "taller_id": nuevo_taller.id}

# ==========================================
# AUTENTICACIÓN (LOGIN)
# ==========================================
class LoginRequest(BaseModel):
    email: str
    password: str

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

def crear_token_acceso(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire}) 
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@app.post("/api/login", tags=["Autenticación"])
def iniciar_sesion(datos: LoginRequest, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.email == datos.email).first()
    
    if not usuario or not pwd_context.verify(datos.password, usuario.password_hash):
        raise HTTPException(status_code=400, detail="Correo o contraseña incorrectos")
        
    datos_token = {
        "sub": usuario.email, 
        "taller_id": usuario.taller_id, 
        "rol": usuario.rol
    }
    token_real = crear_token_acceso(datos_token)
    
    return {
        "access_token": token_real, 
        "token_type": "bearer",
        "taller_id": usuario.taller_id,
        "rol": usuario.rol
    }

# ==========================================
# RUTAS FRONTEND (VISTAS HTML)
# ==========================================
@app.get("/", response_class=FileResponse)
def leer_raiz():
    return "frontend/index.html"

@app.get("/login.html", response_class=FileResponse)
def mostrar_login():
    return "frontend/login.html"

@app.get("/box/{nombre_box}", response_class=FileResponse)
def pantalla_mecanico(nombre_box: str):
    return "frontend/box.html"