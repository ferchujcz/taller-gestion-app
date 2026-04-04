from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base
from sqlalchemy import Float
from sqlalchemy import Date, Boolean# Importa Date también

class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True)
    telefono = Column(String)
    
    # Relación: Un cliente puede tener varios vehículos
    vehiculos = relationship("Vehiculo", back_populates="dueño")

class Vehiculo(Base):
    __tablename__ = "vehiculos"

    id = Column(Integer, primary_key=True, index=True)
    patente = Column(String, unique=True, index=True)
    marca = Column(String)
    modelo = Column(String)
    anio = Column(Integer, nullable=True) # <--- NUEVO CAMPO AÑO
    cliente_id = Column(Integer, ForeignKey("clientes.id"))
    
    # Relaciones
    dueño = relationship("Cliente", back_populates="vehiculos")
    ordenes = relationship("OrdenTrabajo", back_populates="vehiculo")

class OrdenTrabajo(Base):
    __tablename__ = "ordenes_trabajo"

    id = Column(Integer, primary_key=True, index=True)
    vehiculo_id = Column(Integer, ForeignKey("vehiculos.id"))
    
    # Acá manejamos el flujo de trabajo que pediste
    estado = Column(String, default="Turno Asignado") # Ej: En Taller, En Box, Terminado
    ubicacion = Column(String, nullable=True)         # Ej: "Box 1", "Fosa"
    descripcion_falla = Column(String)
    fecha_ingreso = Column(DateTime, default=datetime.utcnow)
    fecha_terminado = Column(DateTime, nullable=True)
    # Relación
    vehiculo = relationship("Vehiculo", back_populates="ordenes")
    # Agregamos esta línea para vincular la orden con sus repuestos/servicios:
    detalles = relationship("DetalleOrden", back_populates="orden", cascade="all, delete-orphan")

# NUEVA TABLA: Los ítems del presupuesto (Repuestos y Mano de Obra)
class DetalleOrden(Base):
    __tablename__ = "detalles_orden"
    id = Column(Integer, primary_key=True, index=True)
    orden_id = Column(Integer, ForeignKey("ordenes_trabajo.id"))
    descripcion = Column(String) # Ej: "Filtro de Aceite"
    cantidad = Column(Integer, default=1)
    precio_unitario = Column(Float)
    
    orden = relationship("OrdenTrabajo", back_populates="detalles")

# NUEVA TABLA: Gestión de Caja (Ingresos y Egresos)
class MovimientoCaja(Base):
    __tablename__ = "caja"
    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String)          # "INGRESO" o "EGRESO"
    metodo_pago = Column(String)   # "Efectivo", "Transferencia", "MercadoPago"
    monto = Column(Float)
    motivo = Column(String)        # Ej: "Pago Orden #12", "Compra yerba y facturas"
    fecha = Column(DateTime, default=datetime.utcnow)

class TallerConfig(Base):
    __tablename__ = "configuracion"

    id = Column(Integer, primary_key=True, index=True)
    nombre_taller = Column(String, default="Mi Taller Automotriz")
    direccion = Column(String, default="")
    telefono = Column(String, default="")
    email = Column(String, default="") # <--- ESTA ES LA LÍNEA QUE FALTABA
    logo_b64 = Column(Text, nullable=True)
# NUEVA TABLA: Empleados
class Empleado(Base):
    __tablename__ = "empleados"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String)
    documento = Column(String, unique=True, index=True) # Este número se usará para generar el QR
    puesto = Column(String, nullable=True) # Ej: "Mecánico Senior", "Administrativo"
    activo = Column(Boolean, default=True) # Para dar de baja sin borrar

    asistencias = relationship("RegistroAsistencia", back_populates="empleado")

# NUEVA TABLA: Registro de Asistencia (Fichadas)
class RegistroAsistencia(Base):
    __tablename__ = "asistencias"
    id = Column(Integer, primary_key=True, index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.id"))
    fecha = Column(Date, default=datetime.utcnow().date())
    hora_entrada = Column(DateTime, default=datetime.utcnow)
    hora_salida = Column(DateTime, nullable=True)
    segundos_trabajados = Column(Integer, default=0) # Para cálculos rápidos de horas

    empleado = relationship("Empleado", back_populates="asistencias")

class ServicioCatalogo(Base):
    __tablename__ = "catalogo"
    id = Column(Integer, primary_key=True, index=True)
    categoria = Column(String)
    nombre = Column(String)
    precio = Column(Float)

class BoxTaller(Base):
    __tablename__ = "boxes"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String)