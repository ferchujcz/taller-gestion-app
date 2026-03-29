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

# Aceptamos la URL con y sin barra final para evitar el 404
@router.post("/")
@router.post("")
def guardar_configuracion(config: schemas.TallerConfigCreate, db: Session = Depends(get_db)):
    try:
        config_actual = db.query(models.TallerConfig).first()
        
        if config_actual:
            config_actual.nombre_taller = config.nombre_taller
            config_actual.direccion = config.direccion
            config_actual.telefono = config.telefono
            config_actual.email = config.email
            if config.logo_b64:
                config_actual.logo_b64 = config.logo_b64
        else:
            nueva_config = models.TallerConfig(**config.dict())
            db.add(nueva_config)
            
        db.commit()
        return {"status": "ok", "mensaje": "Configuración actualizada"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/")
@router.get("")
def obtener_configuracion(db: Session = Depends(get_db)):
    config = db.query(models.TallerConfig).first()
    if not config:
        return {} 
    return config