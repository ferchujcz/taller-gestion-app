from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models, schemas

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

# 2. Actualizar estado o mover de Box (Lo usa el dueño en la PC)
@router.put("/ordenes/{orden_id}")
def actualizar_orden(orden_id: int, datos: schemas.OrdenTrabajoUpdate, db: Session = Depends(get_db)):
    orden = db.query(models.OrdenTrabajo).filter(models.OrdenTrabajo.id == orden_id).first()
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    if datos.estado:
        orden.estado = datos.estado
    if datos.ubicacion:
        orden.ubicacion = datos.ubicacion
        
    db.commit()
    db.refresh(orden)
    return orden

# 3. EL ENDPOINT DEL CÓDIGO QR (Lo usa el celular del mecánico)
@router.get("/ordenes/qr/{nombre_box}")
def leer_qr_box(nombre_box: str, db: Session = Depends(get_db)):
    # El servidor busca qué auto está asignado a ese box en este momento
    orden = db.query(models.OrdenTrabajo).filter(
        models.OrdenTrabajo.ubicacion == nombre_box,
        models.OrdenTrabajo.estado == "En Box"
    ).first()

    if not orden:
        raise HTTPException(status_code=404, detail=f"El {nombre_box} está vacío o el vehículo no está en estado 'En Box'")
    
    # Si hay un auto, le devuelve al celular los datos masticados
    return {
        "id_orden": orden.id,
        "falla": orden.descripcion_falla,
        "vehiculo": f"{orden.vehiculo.marca} {orden.vehiculo.modelo}",
        "patente": orden.vehiculo.patente,
        "dueño": orden.vehiculo.dueño.nombre
    }

# 4. Obtener TODAS las órdenes para el tablero visual
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
            "vehiculo_desc": f"{orden.vehiculo.marca} {orden.vehiculo.modelo}",
            "dueño": orden.vehiculo.dueño.nombre
        })
    return resultado