from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import MovimientoCaja

router = APIRouter(prefix="/caja", tags=["Caja"])

@router.get("/")
def obtener_caja(db: Session = Depends(get_db)):
    return db.query(MovimientoCaja).all()

@router.post("/")
def crear_movimiento(datos: dict, db: Session = Depends(get_db)):
    nuevo_mov = MovimientoCaja(
        tipo=datos.get("tipo", "INGRESO"),
        metodo_pago=datos.get("metodo_pago", "Efectivo"),
        monto=datos.get("monto", 0.0),
        motivo=datos.get("motivo", "")
    )
    db.add(nuevo_mov)
    db.commit()
    return {"mensaje": "Movimiento registrado"}

@router.delete("/{id}")
def borrar_movimiento(id: int, db: Session = Depends(get_db)):
    mov = db.query(MovimientoCaja).filter(MovimientoCaja.id == id).first()
    if mov:
        db.delete(mov)
        db.commit()
    return {"mensaje": "Movimiento eliminado"}