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
from backend.models import Usuario, Taller, TallerConfig, MovimientoCaja, Inventario, Cliente
from backend.routes import vehiculos, ordenes, configuracion, finanzas, empleados, gestion, turnos, clientes, turnos, tareas, asistencia, caja 

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
app.include_router(clientes.router, prefix="/api/clientes")
app.include_router(tareas.router, prefix="/api/tareas")
app.include_router(asistencia.router, prefix="/api/asistencia")
app.include_router(caja.router, prefix="/api/caja")

# ==========================================
# RUTA DE REGISTRO (BLINDADA)
# ==========================================
@app.post("/api/saas/registro", tags=["SaaS Admin"])
def registrar_nuevo_taller(datos: RegistroSaaS, db: Session = Depends(get_db), llave: str = Depends(verificar_llave_maestra)):
    try:
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
    
    except Exception as e:
        # Si algo explota, deshacemos los cambios a medias y mostramos el error real
        db.rollback()
        raise HTTPException(status_code=500, detail=f"ERROR DETALLADO DE BASE DE DATOS: {str(e)}")

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
# --- ESQUEMAS PARA INVENTARIO Y DEUDAS ---
class InventarioCreate(BaseModel):
    codigo: str = ""
    nombre: str
    categoria: str = "Repuesto"
    stock_actual: int = 0
    stock_minimo: int = 5
    precio_costo: float = 0.0
    precio_venta: float = 0.0

class FiadoRequest(BaseModel):
    monto: float

class PagoDeudaRequest(BaseModel):
    monto: float
    metodo_pago: str = "Efectivo"
    # ==========================================
# RUTAS DE INVENTARIO (STOCK)
# ==========================================
@app.get("/api/inventario", tags=["Inventario"])
def obtener_inventario(db: Session = Depends(get_db)):
    return db.query(Inventario).all()

@app.post("/api/inventario", tags=["Inventario"])
def crear_item_inventario(item: InventarioCreate, db: Session = Depends(get_db)):
    nuevo_item = Inventario(
        codigo=item.codigo,
        nombre=item.nombre,
        categoria=item.categoria,
        stock_actual=item.stock_actual,
        stock_minimo=item.stock_minimo,
        precio_costo=item.precio_costo,
        precio_venta=item.precio_venta
    )
    db.add(nuevo_item)
    db.commit()
    return {"mensaje": "Ítem agregado al inventario exitosamente."}

@app.put("/api/inventario/{item_id}/descontar", tags=["Inventario"])
def descontar_stock(item_id: int, cantidad: int, db: Session = Depends(get_db)):
    item = db.query(Inventario).filter(Inventario.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado en el inventario.")
    
    item.stock_actual -= cantidad
    db.commit()
    return {"mensaje": "Stock descontado correctamente.", "stock_restante": item.stock_actual}

# ==========================================
# RUTAS DE FIADO Y CUENTA CORRIENTE
# ==========================================
@app.post("/api/clientes/{cliente_id}/fiado", tags=["Clientes"])
def registrar_fiado(cliente_id: int, req: FiadoRequest, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    # Si el saldo era nulo (por ser un cliente viejo), lo iniciamos en 0
    if cliente.saldo_deuda is None:
        cliente.saldo_deuda = 0.0
        
    cliente.saldo_deuda += req.monto
    db.commit()
    return {"mensaje": f"Deuda registrada. El cliente ahora debe ${cliente.saldo_deuda}"}

@app.post("/api/clientes/{cliente_id}/pagar_deuda", tags=["Clientes"])
def pagar_deuda_cliente(cliente_id: int, req: PagoDeudaRequest, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    if cliente.saldo_deuda is None or cliente.saldo_deuda <= 0:
        raise HTTPException(status_code=400, detail="Este cliente no tiene deudas registradas.")
        
    cliente.saldo_deuda -= req.monto
    if cliente.saldo_deuda < 0:
        cliente.saldo_deuda = 0.0 # No dejamos que el saldo quede negativo
        
    # Magia contable: Registramos el pago de la deuda como un INGRESO en la caja general automáticamente
    nuevo_ingreso = MovimientoCaja(
        tipo="INGRESO",
        monto=req.monto,
        metodo_pago=req.metodo_pago,
        motivo=f"Cobro de Deuda - Cliente: {cliente.nombre}"
    )
    db.add(nuevo_ingreso)
    db.commit()
    
    return {"mensaje": f"Pago registrado en Caja. Deuda restante: ${cliente.saldo_deuda}"}
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

# RUTA SECRETA PARA EL FUNDADOR (Alta Rápida desde el celular)
@app.get("/alta_admin", response_class=FileResponse)
def mostrar_alta_rapida():
    return "frontend/alta.html"