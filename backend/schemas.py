from pydantic import BaseModel
from typing import Optional
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
    # No pedimos el estado ni la ubicación acá porque por defecto 
    # nuestro models.py ya le pone "Turno Asignado"

class OrdenTrabajoUpdate(BaseModel):
    estado: str = None
    ubicacion: str = None

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