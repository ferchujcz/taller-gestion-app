from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models, schemas
from datetime import datetime
from backend.dependencies import obtener_taller_actual

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/empleados/")
def crear_empleado(empleado: schemas.EmpleadoCreate, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    nuevo_empleado = models.Empleado(
        taller_id=taller_actual,
        nombre=empleado.nombre, 
        documento=empleado.documento, 
        puesto=empleado.puesto
    )
    db.add(nuevo_empleado)
    db.commit()
    db.refresh(nuevo_empleado)
    return nuevo_empleado

@router.get("/empleados/")
def obtener_empleados(db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    return db.query(models.Empleado).filter(models.Empleado.taller_id == taller_actual).all()

@router.put("/{empleado_id}")
def editar_empleado(empleado_id: int, empleado: schemas.EmpleadoCreate, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    emp = db.query(models.Empleado).filter(models.Empleado.id == empleado_id, models.Empleado.taller_id == taller_actual).first()
    if emp:
        emp.nombre = empleado.nombre
        emp.documento = empleado.documento
        emp.puesto = empleado.puesto
        db.commit()
        db.refresh(emp)
    return emp

@router.delete("/{empleado_id}")
def eliminar_empleado(empleado_id: int, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    emp = db.query(models.Empleado).filter(models.Empleado.id == empleado_id, models.Empleado.taller_id == taller_actual).first()
    if emp:
        db.delete(emp)
        db.commit()
    return {"status": "ok"}

@router.post("/asistencia/fichar")
def registrar_fichada(fichada: schemas.RegistroAsistenciaCreate, db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    empleado = db.query(models.Empleado).filter(models.Empleado.documento == fichada.documento, models.Empleado.taller_id == taller_actual).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
        
    ahora = datetime.utcnow()
    fecha_hoy = ahora.date()
    
    fichada_abierta = db.query(models.RegistroAsistencia).filter(
        models.RegistroAsistencia.empleado_id == empleado.id,
        models.RegistroAsistencia.taller_id == taller_actual,
        models.RegistroAsistencia.fecha == fecha_hoy,
        models.RegistroAsistencia.hora_salida == None
    ).first()
    
    if fichada_abierta:
        fichada_abierta.hora_salida = ahora
        diferencia = ahora - fichada_abierta.hora_entrada
        fichada_abierta.segundos_trabajados = int(diferencia.total_seconds())
        db.commit()
        horas_trabajadas = round(fichada_abierta.segundos_trabajados / 3600, 2)
        return {"status": "success", "mensaje": f"Salida registrada para {empleado.nombre}. Horas trabajadas hoy: {horas_trabajadas}"}
    else:
        nueva_entrada = models.RegistroAsistencia(taller_id=taller_actual, empleado_id=empleado.id, fecha=fecha_hoy, hora_entrada=ahora)
        db.add(nueva_entrada)
        db.commit()
        return {"status": "success", "mensaje": f"Entrada registrada para {empleado.nombre}"}

@router.get("/asistencia/presentes")
def obtener_empleados_presentes(db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    fecha_hoy = datetime.utcnow().date()
    registros_abiertos = db.query(models.RegistroAsistencia).filter(
        models.RegistroAsistencia.taller_id == taller_actual,
        models.RegistroAsistencia.fecha == fecha_hoy,
        models.RegistroAsistencia.hora_salida == None
    ).all()
    
    presentes = [{"nombre": reg.empleado.nombre, "hora_entrada": reg.hora_entrada} for reg in registros_abiertos]
    return presentes

@router.get("/asistencia/")
def obtener_historial_asistencia(db: Session = Depends(get_db), taller_actual: int = Depends(obtener_taller_actual)):
    asistencias = db.query(models.RegistroAsistencia).filter(models.RegistroAsistencia.taller_id == taller_actual).all()
    resultado = []
    for a in asistencias:
        resultado.append({
            "id": a.id,
            "empleado_id": a.empleado_id,
            "nombre": a.empleado.nombre if a.empleado else "Desconocido",
            "documento": a.empleado.documento if a.empleado else "Sin DNI",
            "hora_entrada": a.hora_entrada,
            "hora_salida": a.hora_salida
        })
    return resultado