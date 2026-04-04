from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models, schemas
import datetime

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 1. Crear un nuevo turno/orden de trabajo
@router.post("/ordenes/")
def crear_orden(orden: schemas.OrdenTrabajoCreate, db: Session = Depends(get_db)):
    nueva_orden = models.OrdenTrabajo(
        vehiculo_id=orden.vehiculo_id,
        descripcion_falla=orden.descripcion_falla
    )
    db.add(nueva_orden)
    db.commit()
    db.refresh(nueva_orden)
    return nueva_orden

# 2. Actualizar estado, mover de Box o Marcar como Terminado (TODO UNIFICADO)
@router.put("/ordenes/{orden_id}")
def actualizar_orden(orden_id: int, datos: dict, db: Session = Depends(get_db)):
    orden = db.query(models.OrdenTrabajo).filter(models.OrdenTrabajo.id == orden_id).first()
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    # Si viene el estado, lo cambiamos
    if 'estado' in datos:
        orden.estado = datos['estado']
        # Si se marcó como terminado, Python anota automáticamente la fecha/hora
        if orden.estado == 'Terminado' and not orden.fecha_terminado:
            orden.fecha_terminado = datetime.datetime.now()
            
    # Si viene la ubicación (el box), la cambiamos
    if 'ubicacion' in datos:
        orden.ubicacion = datos['ubicacion']
        
    db.commit()
    db.refresh(orden)
    return orden

# 3. EL ENDPOINT DEL CÓDIGO QR (Lo usa el celular del mecánico)
@router.get("/ordenes/qr/{nombre_box}")
def leer_qr_box(nombre_box: str, db: Session = Depends(get_db)):
    orden = db.query(models.OrdenTrabajo).filter(
        models.OrdenTrabajo.ubicacion == nombre_box,
        models.OrdenTrabajo.estado == "En Box"
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
def obtener_ordenes(db: Session = Depends(get_db)):
    ordenes = db.query(models.OrdenTrabajo).all()
    
    resultado = []
    for orden in ordenes:
        resultado.append({
            "id": orden.id,
            "estado": orden.estado,
            "ubicacion": orden.ubicacion or "Sin asignar",
            "falla": orden.descripcion_falla,
            "patente": orden.vehiculo.patente,
            "vehiculo_id": orden.vehiculo_id, # <--- AGREGAR ESTA LÍNEA PARA EL CRM
            "vehiculo_desc": f"{orden.vehiculo.marca} {orden.vehiculo.modelo}",
            "dueño": orden.vehiculo.dueño.nombre,
            "fecha_ingreso": orden.fecha_ingreso,
            "fecha_terminado": orden.fecha_terminado
        })
    return resultado


# =====================================================================
# RUTAS DE LOS REPUESTOS Y MANO DE OBRA (Presupuesto)
# =====================================================================

# A. Agregar un ítem nuevo (Desde el Celular del Mecánico o la PC)
@router.post("/ordenes/{orden_id}/detalles")
def agregar_detalle(orden_id: int, datos: dict, db: Session = Depends(get_db)):
    nuevo_detalle = models.DetalleOrden(
        orden_id=orden_id,
        descripcion=datos['descripcion'],
        cantidad=datos['cantidad'],
        precio_unitario=datos.get('precio_unitario', 0)
    )
    db.add(nuevo_detalle)
    db.commit()
    db.refresh(nuevo_detalle)
    return nuevo_detalle

# B. Leer la lista de ítems de una orden
@router.get("/ordenes/{orden_id}/detalles")
def obtener_detalles(orden_id: int, db: Session = Depends(get_db)):
    return db.query(models.DetalleOrden).filter(models.DetalleOrden.orden_id == orden_id).all()

# C. Modificar el precio de un ítem (La nueva función que querías para el dueño)
@router.put("/ordenes/detalles/{detalle_id}")
def actualizar_precio_detalle(detalle_id: int, datos: dict, db: Session = Depends(get_db)):
    detalle = db.query(models.DetalleOrden).filter(models.DetalleOrden.id == detalle_id).first()
    if detalle:
        if 'precio_unitario' in datos:
            detalle.precio_unitario = datos['precio_unitario']
        db.commit()
    return detalle

# D. Eliminar un ítem si se cargó por error
@router.delete("/ordenes/detalles/{detalle_id}")
def borrar_detalle(detalle_id: int, db: Session = Depends(get_db)):
    detalle = db.query(models.DetalleOrden).filter(models.DetalleOrden.id == detalle_id).first()
    if detalle:
        db.delete(detalle)
        db.commit()
    return {"mensaje": "Detalle eliminado correctamente"}