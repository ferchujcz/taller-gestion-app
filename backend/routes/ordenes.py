from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models, schemas
import datetime
from backend.models import OrdenTrabajo, DetalleOrden, Vehiculo, Tarea, Empleado
from backend.schemas import TareaCreate, TareaUpdateEstado 
from backend.dependencies import obtener_taller_actual

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 1. Crear un nuevo turno/orden de trabajo
@router.post("/ordenes/")
def crear_orden(orden: schemas.OrdenTrabajoCreate, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    nueva_orden = models.OrdenTrabajo(
        taller_id=taller_actual,
        vehiculo_id=orden.vehiculo_id,
        descripcion_falla=orden.descripcion_falla,
        nivel_combustible=orden.nivel_combustible,
        detalles_ingreso=orden.detalles_ingreso
    )
    db.add(nueva_orden)
    db.commit()
    db.refresh(nueva_orden)
    return nueva_orden

# 2. Actualizar estado, mover de Box o Marcar como Terminado (TODO UNIFICADO)
@router.put("/ordenes/{orden_id}")
def actualizar_orden(orden_id: int, datos: dict, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    orden = db.query(models.OrdenTrabajo).filter(models.OrdenTrabajo.id == orden_id, models.OrdenTrabajo.taller_id == taller_actual).first()
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    if 'estado' in datos:
        orden.estado = datos['estado']
    if orden.estado == 'Terminado' and not orden.fecha_terminado:
        orden.fecha_terminado = datetime.datetime.utcnow()
    if 'ubicacion' in datos:
        orden.ubicacion = datos['ubicacion']
        
    db.commit()
    db.refresh(orden)
    return orden

# 3. EL ENDPOINT DEL CÓDIGO QR (Lo usa el celular del mecánico)
@router.get("/ordenes/qr/{nombre_box}")
def leer_qr_box(nombre_box: str, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    orden = db.query(models.OrdenTrabajo).filter(
        models.OrdenTrabajo.ubicacion == nombre_box,
        models.OrdenTrabajo.estado == "En Box",
        models.OrdenTrabajo.taller_id == taller_actual
    ).first()

    if not orden:
        raise HTTPException(status_code=404, detail=f"El {nombre_box} está vacío o el vehículo no está en estado 'En Box'")
    
    return {
        "id_orden": orden.id,
        "falla": orden.descripcion_falla,
        "vehiculo": f"{orden.vehiculo.marca} {orden.vehiculo.modelo}",
        "patente": orden.vehiculo.patente,
        "dueño": orden.vehiculo.dueño.nombre
    }

# 4. Obtener TODAS las órdenes para el tablero visual y cálculos de métricas
@router.get("/ordenes/")
def obtener_ordenes(db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    ordenes = db.query(models.OrdenTrabajo).filter(models.OrdenTrabajo.taller_id == taller_actual).all()
    
    resultado = []
    for orden in ordenes:
        resultado.append({
            "id": orden.id,
            "estado": orden.estado,
            "ubicacion": orden.ubicacion or "Sin asignar",
            "falla": orden.descripcion_falla,
            "patente": orden.vehiculo.patente,
            "vehiculo_id": orden.vehiculo_id, 
            "vehiculo_desc": f"{orden.vehiculo.marca} {orden.vehiculo.modelo}",
            "dueño": orden.vehiculo.dueño.nombre,
            "fecha_ingreso": orden.fecha_ingreso,
            "fecha_terminado": orden.fecha_terminado
        })
    return resultado

# =====================================================================
# RUTAS DE LOS REPUESTOS Y MANO DE OBRA (Presupuesto)
# =====================================================================

@router.post("/ordenes/{orden_id}/detalles")
def agregar_detalle(orden_id: int, datos: dict, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    nuevo_detalle = models.DetalleOrden(
        taller_id=taller_actual,
        orden_id=orden_id,
        descripcion=datos['descripcion'],
        cantidad=datos['cantidad'],
        precio_unitario=datos.get('precio_unitario', 0)
    )
    db.add(nuevo_detalle)
    db.commit()
    db.refresh(nuevo_detalle)
    return nuevo_detalle

@router.get("/ordenes/{orden_id}/detalles")
def obtener_detalles(orden_id: int, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    return db.query(models.DetalleOrden).filter(models.DetalleOrden.orden_id == orden_id, models.DetalleOrden.taller_id == taller_actual).all()

@router.put("/ordenes/detalles/{detalle_id}")
def actualizar_precio_detalle(detalle_id: int, datos: dict, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    detalle = db.query(models.DetalleOrden).filter(models.DetalleOrden.id == detalle_id, models.DetalleOrden.taller_id == taller_actual).first()
    if detalle:
        if 'precio_unitario' in datos:
            detalle.precio_unitario = datos['precio_unitario']
        db.commit()
    return detalle

@router.delete("/ordenes/detalles/{detalle_id}")
def borrar_detalle(detalle_id: int, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    detalle = db.query(models.DetalleOrden).filter(models.DetalleOrden.id == detalle_id, models.DetalleOrden.taller_id == taller_actual).first()
    if detalle:
        db.delete(detalle)
        db.commit()
    return {"mensaje": "Detalle eliminado correctamente"}

# ==========================================
# RUTAS DEL TURNERO MENSUAL (Espejo por si tu JS apunta acá)
# ==========================================

@router.post("/turnos/")
def crear_turno(turno: schemas.TurnoCreate, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    nuevo_turno = models.Turno(
        taller_id=taller_actual,
        fecha_hora=turno.fecha_hora,
        cliente_nombre=turno.cliente_nombre,
        vehiculo=turno.vehiculo,
        motivo=turno.motivo,
        estado=turno.estado
    )
    db.add(nuevo_turno)
    db.commit()
    db.refresh(nuevo_turno)
    return nuevo_turno

@router.get("/turnos/")
def obtener_turnos(db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    return db.query(models.Turno).filter(models.Turno.taller_id == taller_actual).all()

@router.put("/turnos/{turno_id}")
def actualizar_estado_turno(turno_id: int, datos: dict, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    turno = db.query(models.Turno).filter(models.Turno.id == turno_id, models.Turno.taller_id == taller_actual).first()
    if turno and 'estado' in datos:
        turno.estado = datos['estado']
        db.commit()
        db.refresh(turno)
    return turno

# ==========================================
# CAJA Y CUENTAS CORRIENTES (COBRO SEGURO)
# ==========================================
@router.post("/ordenes/{orden_id}/cobrar")
def cobrar_orden_seguro(orden_id: int, datos: dict, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    orden = db.query(models.OrdenTrabajo).filter(models.OrdenTrabajo.id == orden_id, models.OrdenTrabajo.taller_id == taller_actual).first()
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    monto = datos.get('monto', 0)
    metodo = datos.get('metodo_pago', 'Efectivo')

    orden.estado = 'Entregado'
    orden.ubicacion = 'Entregado'

    if metodo == 'Fiado':
        if orden.vehiculo and orden.vehiculo.dueño:
            orden.vehiculo.dueño.saldo_deudor += monto

    nuevo_mov = models.MovimientoCaja(
        taller_id=taller_actual,
        tipo='INGRESO',
        metodo_pago=metodo,
        monto=monto,
        motivo=f"Cobro Orden #{orden.id} - {orden.vehiculo.patente}",
        orden_id=orden.id
    )
    
    db.add(nuevo_mov)
    db.commit()
    return {"mensaje": "Cobro exitoso y registrado."}

# ==========================================
# TABLERO DE TAREAS
# ==========================================
@router.post("/tareas/", tags=["Tablero Tareas"])
def crear_tarea(datos: TareaCreate, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    nueva_tarea = Tarea(
        taller_id=taller_actual,
        orden_id=datos.orden_id,
        empleado_id=datos.empleado_id,
        descripcion=datos.descripcion
    )
    db.add(nueva_tarea)
    db.commit()
    return {"mensaje": "Tarea asignada con éxito"}

@router.get("/tareas/", tags=["Tablero Tareas"])
def obtener_todas_las_tareas(db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    tareas = db.query(Tarea).filter(Tarea.taller_id == taller_actual).all()
    resultado = []
    for t in tareas:
        resultado.append({
            "id": t.id,
            "descripcion": t.descripcion,
            "estado": t.estado,
            "mecanico": t.empleado.nombre if t.empleado else "Sin Asignar",
            "vehiculo": f"{t.orden.vehiculo.marca} {t.orden.vehiculo.modelo}" if t.orden and t.orden.vehiculo else "Desconocido",
            "box": t.orden.ubicacion
        })
    return resultado

@router.put("/tareas/{tarea_id}", tags=["Tablero Tareas"])
def actualizar_estado_tarea(tarea_id: int, datos: TareaUpdateEstado, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    tarea = db.query(Tarea).filter(Tarea.id == tarea_id, Tarea.taller_id == taller_actual).first()
    if not tarea:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")

    tarea.estado = datos.estado
    db.commit()
    return {"mensaje": f"Tarea marcada como {datos.estado}"}