from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models, schemas
from backend.dependencies import obtener_taller_actual

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/clientes/")
def crear_cliente(cliente: schemas.ClienteCreate, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    nuevo_cliente = models.Cliente(
        taller_id=taller_actual,
        nombre=cliente.nombre, 
        telefono=cliente.telefono
    )
    db.add(nuevo_cliente)
    db.commit()
    db.refresh(nuevo_cliente)
    return nuevo_cliente

@router.post("/vehiculos/")
def crear_vehiculo(vehiculo: schemas.VehiculoCreate, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    nuevo_vehiculo = models.Vehiculo(
        taller_id=taller_actual,
        patente=vehiculo.patente,
        marca=vehiculo.marca,
        modelo=vehiculo.modelo,
        cliente_id=vehiculo.cliente_id
    )
    db.add(nuevo_vehiculo)
    db.commit()
    db.refresh(nuevo_vehiculo)
    return nuevo_vehiculo

@router.get("/vehiculos/")
def obtener_vehiculos(db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    vehiculos = db.query(models.Vehiculo).filter(models.Vehiculo.taller_id == taller_actual).all()
    return vehiculos

@router.get("/clientes/")
def obtener_clientes(db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    clientes = db.query(models.Cliente).filter(models.Cliente.taller_id == taller_actual).all()
    return clientes