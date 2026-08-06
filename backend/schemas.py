from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class RegistroSaaS(BaseModel):
    nombre_taller: str
    telefono_taller: str
    email_admin: EmailStr
    password_admin: str
    codigo_afiliado: Optional[str] = None # Opcional, por si vienen sin código
    
# Esquema para cuando creamos un cliente nuevo
class ClienteCreate(BaseModel):
    nombre: str
    telefono: str

# Esquema para cuando ingresamos un vehículo nuevo
class VehiculoCreate(BaseModel):
    patente: str
    marca: str
    modelo: str
    anio: int = None # <--- NUEVO CAMPO AÑO (Opcional por si no lo saben)
    cliente_id: int

# (Añade esto al final de schemas.py)

class OrdenTrabajoCreate(BaseModel):
    vehiculo_id: int
    descripcion_falla: str
    nivel_combustible: Optional[str] = None
    detalles_ingreso: Optional[str] = None
    
class OrdenTrabajoUpdate(BaseModel):
    estado: str = None
    ubicacion: str = None
    nivel_combustible: Optional[str] = None  # <--- AGREGAR
    detalles_ingreso: Optional[str] = None   # <--- AGREGAR

class ConfigUpdate(BaseModel):
    nombre_taller: str
    direccion: str
    telefono: str
    email: str
    logo_b64: str = None

# Validar los ítems del presupuesto
class DetalleOrdenCreate(BaseModel):
    descripcion: str
    cantidad: int
    precio_unitario: float

# Validar los movimientos de la caja
class MovimientoCajaCreate(BaseModel):
    tipo: str
    metodo_pago: str
    monto: float
    motivo: str


class EmpleadoCreate(BaseModel):
    nombre: str
    documento: str
    puesto: str = None

class RegistroAsistenciaCreate(BaseModel):
    documento: str
# --- ESQUEMAS DE CONFIGURACIÓN ---
class TallerConfigCreate(BaseModel):
    nombre_taller: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    logo_b64: Optional[str] = None

class TallerConfig(TallerConfigCreate):
    id: int

    class Config:
        orm_mode = True
        from_attributes = True

# --- ESQUEMAS PARA CATÁLOGO Y BOXES ---
class ServicioCatalogoBase(BaseModel):
    categoria: str
    nombre: str
    precio: float

class ServicioCatalogo(ServicioCatalogoBase):
    id: int
    class Config:
        from_attributes = True

class BoxTallerBase(BaseModel):
    nombre: str

class BoxTaller(BoxTallerBase):
    id: int
    class Config:
        from_attributes = True

class TurnoBase(BaseModel):
    fecha_hora: datetime
    cliente_nombre: str
    vehiculo: str
    motivo: str
    estado: Optional[str] = "Pendiente"

class TurnoCreate(TurnoBase):
    pass

class TurnoResponse(TurnoBase):
    id: int
    taller_id: int
    
    class Config:
        orm_mode = True

class TareaCreate(BaseModel):
    orden_id: int
    empleado_id: Optional[int] = None
    descripcion: str

class TareaUpdateEstado(BaseModel):
    estado: str # "En Proceso" o "Terminada"
