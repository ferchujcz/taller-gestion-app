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

# --- 1. RUTAS PARA PRESUPUESTOS (Ítems de las Órdenes) ---

@router.post("/ordenes/{orden_id}/detalles")
def agregar_detalle_orden(orden_id: int, detalle: schemas.DetalleOrdenCreate, db: Session = Depends(get_db)):
    orden = db.query(models.OrdenTrabajo).filter(models.OrdenTrabajo.id == orden_id).first()
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
        
    nuevo_detalle = models.DetalleOrden(
        orden_id=orden_id,
        descripcion=detalle.descripcion,
        cantidad=detalle.cantidad,
        precio_unitario=detalle.precio_unitario
    )
    db.add(nuevo_detalle)
    db.commit()
    db.refresh(nuevo_detalle)
    return nuevo_detalle

@router.get("/ordenes/{orden_id}/detalles")
def obtener_detalles_orden(orden_id: int, db: Session = Depends(get_db)):
    detalles = db.query(models.DetalleOrden).filter(models.DetalleOrden.orden_id == orden_id).all()
    return detalles


# --- 2. RUTAS PARA LA CAJA ---

@router.post("/caja/")
def registrar_movimiento(movimiento: schemas.MovimientoCajaCreate, db: Session = Depends(get_db)):
    nuevo_movimiento = models.MovimientoCaja(
        tipo=movimiento.tipo,
        metodo_pago=movimiento.metodo_pago,
        monto=movimiento.monto,
        motivo=movimiento.motivo
    )
    db.add(nuevo_movimiento)
    db.commit()
    db.refresh(nuevo_movimiento)
    return nuevo_movimiento

@router.get("/caja/")
def obtener_movimientos_caja(db: Session = Depends(get_db)):
    return db.query(models.MovimientoCaja).order_by(models.MovimientoCaja.fecha.desc()).all()


@router.delete("/{movimiento_id}")
def eliminar_movimiento(movimiento_id: int, db: Session = Depends(get_db)):
    mov = db.query(models.MovimientoCaja).filter(models.MovimientoCaja.id == movimiento_id).first()
    if mov:
        db.delete(mov)
        db.commit()
    return {"status": "ok"}