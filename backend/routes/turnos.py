from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend import models, schemas
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend import models, schemas
from backend.dependencies import obtener_taller_actual
from pydantic import BaseModel

router = APIRouter()

class EstadoTurnoUpdate(BaseModel):
    estado: str

@router.get("/turnos/", response_model=list[schemas.TurnoResponse], tags=["Agenda y Turnos"])
def obtener_turnos(db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    return db.query(models.Turno).filter(models.Turno.taller_id == taller_actual).order_by(models.Turno.fecha_hora).all()

@router.post("/turnos/", response_model=schemas.TurnoResponse, tags=["Agenda y Turnos"])
def agendar_turno(turno: schemas.TurnoCreate, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    nuevo_turno = models.Turno(
        taller_id=taller_actual, # Asignamos el taller dueño
        fecha_hora=turno.fecha_hora,
        cliente_nombre=turno.cliente_nombre,
        vehiculo=turno.vehiculo,
        motivo=turno.motivo,
        estado="Pendiente"
    )
    db.add(nuevo_turno)
    db.commit()
    db.refresh(nuevo_turno)
    return nuevo_turno

@router.put("/turnos/{turno_id}", tags=["Agenda y Turnos"])
def actualizar_estado_turno(turno_id: int, datos: EstadoTurnoUpdate, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    turno_db = db.query(models.Turno).filter(models.Turno.id == turno_id, models.Turno.taller_id == taller_actual).first()
    if not turno_db:
        raise HTTPException(status_code=404, detail="Turno no encontrado o no pertenece a su taller")
    
    turno_db.estado = datos.estado
    db.commit()
    return {"mensaje": "Estado actualizado"}