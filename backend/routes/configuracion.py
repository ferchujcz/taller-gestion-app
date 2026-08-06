from fastapi import APIRouter, Depends, HTTPException
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

@router.post("/")
@router.post("")
def guardar_configuracion(config: schemas.TallerConfigCreate, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    try:
        config_actual = db.query(models.TallerConfig).filter(models.TallerConfig.taller_id == taller_actual).first()
        
        if config_actual:
            if config.nombre_taller: config_actual.nombre_taller = config.nombre_taller
            if config.direccion: config_actual.direccion = config.direccion
            if config.telefono: config_actual.telefono = config.telefono
            if config.email: config_actual.email = config.email
            if config.logo_b64: config_actual.logo_b64 = config.logo_b64
        else:
            nueva_config = models.TallerConfig(**config.dict(), taller_id=taller_actual)
            db.add(nueva_config)
            
        db.commit()
        return {"status": "ok", "mensaje": "Configuración actualizada"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
@router.get("")
def obtener_configuracion(db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    config = db.query(models.TallerConfig).filter(models.TallerConfig.taller_id == taller_actual).first()
    if not config:
        return {} 
    return config