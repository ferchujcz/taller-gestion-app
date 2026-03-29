from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models, schemas

router = APIRouter()

# Dependencia: Abre una conexión a la base de datos por cada petición y la cierra al terminar
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Ruta para GUARDAR un cliente nuevo
@router.post("/clientes/")
def crear_cliente(cliente: schemas.ClienteCreate, db: Session = Depends(get_db)):
    nuevo_cliente = models.Cliente(nombre=cliente.nombre, telefono=cliente.telefono)
    db.add(nuevo_cliente)
    db.commit()
    db.refresh(nuevo_cliente)
    return nuevo_cliente

# Ruta para GUARDAR un vehículo nuevo
@router.post("/vehiculos/")
def crear_vehiculo(vehiculo: schemas.VehiculoCreate, db: Session = Depends(get_db)):
    nuevo_vehiculo = models.Vehiculo(
        patente=vehiculo.patente,
        marca=vehiculo.marca,
        modelo=vehiculo.modelo,
        cliente_id=vehiculo.cliente_id
    )
    db.add(nuevo_vehiculo)
    db.commit()
    db.refresh(nuevo_vehiculo)
    return nuevo_vehiculo

# Ruta para LEER todos los vehículos
@router.get("/vehiculos/")
def obtener_vehiculos(db: Session = Depends(get_db)):
    vehiculos = db.query(models.Vehiculo).all()
    return vehiculos

# Ruta para LEER todos los clientes
@router.get("/clientes/")
def obtener_clientes(db: Session = Depends(get_db)):
    clientes = db.query(models.Cliente).all()
    return clientes