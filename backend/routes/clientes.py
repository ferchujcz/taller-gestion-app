from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.models import Cliente

router = APIRouter(prefix="/clientes", tags=["Clientes"])

@router.get("/")
def obtener_clientes(db: Session = Depends(get_db)):
    return db.query(Cliente).all()

@router.post("/")
def crear_cliente(datos: dict, db: Session = Depends(get_db)):
    nuevo_cliente = Cliente(
        nombre=datos.get("nombre"),
        telefono=datos.get("telefono"),
        saldo_deuda=0.0
    )
    db.add(nuevo_cliente)
    db.commit()
    db.refresh(nuevo_cliente)
    return nuevo_cliente