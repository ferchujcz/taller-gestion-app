from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from backend.database import SessionLocal
from backend import models, schemas

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- CATÁLOGO ---
@router.get("/catalogo", response_model=List[schemas.ServicioCatalogo])
def obtener_catalogo(db: Session = Depends(get_db)):
    return db.query(models.ServicioCatalogo).all()

@router.post("/catalogo", response_model=schemas.ServicioCatalogo)
def crear_servicio(servicio: schemas.ServicioCatalogoBase, db: Session = Depends(get_db)):
    nuevo = models.ServicioCatalogo(**servicio.dict())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@router.put("/catalogo/{id}", response_model=schemas.ServicioCatalogo)
def editar_servicio(id: int, servicio: schemas.ServicioCatalogoBase, db: Session = Depends(get_db)):
    serv = db.query(models.ServicioCatalogo).filter(models.ServicioCatalogo.id == id).first()
    if serv:
        serv.categoria = servicio.categoria
        serv.nombre = servicio.nombre
        serv.precio = servicio.precio
        db.commit()
        db.refresh(serv)
    return serv

@router.delete("/catalogo/{id}")
def eliminar_servicio(id: int, db: Session = Depends(get_db)):
    serv = db.query(models.ServicioCatalogo).filter(models.ServicioCatalogo.id == id).first()
    if serv:
        db.delete(serv)
        db.commit()
    return {"status": "ok"}

# --- BOXES ---
@router.get("/boxes", response_model=List[schemas.BoxTaller])
def obtener_boxes(db: Session = Depends(get_db)):
    return db.query(models.BoxTaller).all()

@router.post("/boxes", response_model=schemas.BoxTaller)
def crear_box(box: schemas.BoxTallerBase, db: Session = Depends(get_db)):
    nuevo = models.BoxTaller(**box.dict())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@router.delete("/boxes/{id}")
def eliminar_box(id: int, db: Session = Depends(get_db)):
    box = db.query(models.BoxTaller).filter(models.BoxTaller.id == id).first()
    if box:
        db.delete(box)
        db.commit()
    return {"status": "ok"}