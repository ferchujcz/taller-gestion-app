from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base
from sqlalchemy import Float
from sqlalchemy import Date, Boolean# Importa Date también

class Taller(Base):
    __tablename__ = "talleres"

    id = Column(Integer, primary_key=True, index=True)
    nombre_fantasia = Column(String, index=True)
    email_contacto = Column(String, unique=True, index=True)
    telefono = Column(String)
    codigo_afiliado = Column(String, nullable=True) # ¡Acá rastreamos las ventas del influencer!
    activo = Column(Boolean, default=True)

    # Relación: Un taller tiene muchos usuarios
    usuarios = relationship("Usuario", back_populates="taller")
class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    rol = Column(String, default="admin") # Puede ser admin o mecanico
    
    taller_id = Column(Integer, ForeignKey("talleres.id"))
    taller = relationship("Taller", back_populates="usuarios")
class Turno(Base):
    __tablename__ = "turnos"
    id = Column(Integer, primary_key=True, index=True)
    taller_id = Column(Integer, ForeignKey("talleres.id"), default=1)
    fecha_hora = Column(DateTime)
    cliente_nombre = Column(String)
    vehiculo = Column(String)
    motivo = Column(String)
    estado = Column(String, default="Pendiente") # Pendiente, Confirmado, Cancelado

class Cliente(Base):
    __tablename__ = "clientes"

    id = Column(Integer, primary_key=True, index=True)
    taller_id = Column(Integer, ForeignKey("talleres.id"), default=1) # <--- Faltaba esta línea
    nombre = Column(String, index=True)
    telefono = Column(String)
    saldo_deudor = Column(Float, default=0.0)
    
    vehiculos = relationship("Vehiculo", back_populates="dueño")

class Vehiculo(Base):
    __tablename__ = "vehiculos"
    id = Column(Integer, primary_key=True, index=True)
    taller_id = Column(Integer, ForeignKey("talleres.id"), default=1)
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
    taller_id = Column(Integer, ForeignKey("talleres.id"), default=1)
    vehiculo_id = Column(Integer, ForeignKey("vehiculos.id"))
    
    estado = Column(String, default="Turno Asignado") 
    ubicacion = Column(String, nullable=True)         
    descripcion_falla = Column(String)
    fecha_ingreso = Column(DateTime, default=datetime.utcnow)
    fecha_terminado = Column(DateTime, nullable=True)

    # ESTOS 3 CAMPOS AHORA ESTÁN PERFECTOS
    nivel_combustible = Column(String, nullable=True) 
    detalles_ingreso = Column(String, nullable=True)  
    fotos_inspeccion = Column(Text, nullable=True)    
    
    vehiculo = relationship("Vehiculo", back_populates="ordenes")
    detalles = relationship("DetalleOrden", back_populates="orden", cascade="all, delete-orphan")
# NUEVA TABLA: Los ítems del presupuesto (Repuestos y Mano de Obra)
class DetalleOrden(Base):

    __tablename__ = "detalles_orden"
    id = Column(Integer, primary_key=True, index=True)
    taller_id = Column(Integer, ForeignKey("talleres.id"), default=1)
    orden_id = Column(Integer, ForeignKey("ordenes_trabajo.id"))
    descripcion = Column(String) # Ej: "Filtro de Aceite"
    cantidad = Column(Integer, default=1)
    precio_unitario = Column(Float)
    
    orden = relationship("OrdenTrabajo", back_populates="detalles")

# NUEVA TABLA: Gestión de Caja (Ingresos y Egresos)
class MovimientoCaja(Base):
    __tablename__ = "caja"
    id = Column(Integer, primary_key=True, index=True)
    taller_id = Column(Integer, ForeignKey("talleres.id"), default=1)
    tipo = Column(String)          # "INGRESO" o "EGRESO"
    metodo_pago = Column(String)   # "Efectivo", "Transferencia", "MercadoPago"
    monto = Column(Float)
    motivo = Column(String)        # Ej: "Pago Orden #12", "Compra yerba y facturas"
    fecha = Column(DateTime, default=datetime.utcnow)
    orden_id = Column(Integer, ForeignKey("ordenes_trabajo.id"), nullable=True)

class TallerConfig(Base):
    __tablename__ = "configuracion"

    id = Column(Integer, primary_key=True, index=True)
    taller_id = Column(Integer, ForeignKey("talleres.id"), default=1)
    nombre_taller = Column(String, default="Mi Taller Automotriz")
    direccion = Column(String, default="")
    telefono = Column(String, default="")
    email = Column(String, default="") # <--- ESTA ES LA LÍNEA QUE FALTABA
    logo_b64 = Column(Text, nullable=True)
# NUEVA TABLA: Empleados
class Empleado(Base):
    __tablename__ = "empleados"
    id = Column(Integer, primary_key=True, index=True)
    taller_id = Column(Integer, ForeignKey("talleres.id"), default=1)
    nombre = Column(String)
    documento = Column(String, unique=True, index=True) # Este número se usará para generar el QR
    puesto = Column(String, nullable=True) # Ej: "Mecánico Senior", "Administrativo"
    activo = Column(Boolean, default=True) # Para dar de baja sin borrar

    asistencias = relationship("RegistroAsistencia", back_populates="empleado")

# NUEVA TABLA: Registro de Asistencia (Fichadas)
class RegistroAsistencia(Base):
    __tablename__ = "asistencias"
    id = Column(Integer, primary_key=True, index=True)
    taller_id = Column(Integer, ForeignKey("talleres.id"), default=1)
    empleado_id = Column(Integer, ForeignKey("empleados.id"))
    fecha = Column(Date, default=datetime.utcnow().date())
    hora_entrada = Column(DateTime, default=datetime.utcnow)
    hora_salida = Column(DateTime, nullable=True)
    segundos_trabajados = Column(Integer, default=0) # Para cálculos rápidos de horas

    empleado = relationship("Empleado", back_populates="asistencias")

class ServicioCatalogo(Base):
    __tablename__ = "catalogo"
    id = Column(Integer, primary_key=True, index=True)
    taller_id = Column(Integer, ForeignKey("talleres.id"), default=1)
    categoria = Column(String)
    nombre = Column(String)
    precio = Column(Float)

class BoxTaller(Base):
    __tablename__ = "boxes"
    id = Column(Integer, primary_key=True, index=True)
    taller_id = Column(Integer, ForeignKey("talleres.id"), default=1)
    nombre = Column(String)

class Tarea(Base):
    __tablename__ = "tareas"
    id = Column(Integer, primary_key=True, index=True)
    taller_id = Column(Integer, ForeignKey("talleres.id"), default=1)
    orden_id = Column(Integer, ForeignKey("ordenes_trabajo.id"))
    empleado_id = Column(Integer, ForeignKey("empleados.id"), nullable=True) # Puede estar sin asignar al principio
    
    descripcion = Column(String)
    estado = Column(String, default="Pendiente") # Pendiente, En Proceso, Terminada
    
    # Relaciones para que SQLAlchemy traiga los datos fácil
    orden = relationship("OrdenTrabajo")
    empleado = relationship("Empleado")