from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend import models, schemas
from datetime import datetime

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- RUTAS DE GESTIÓN DE EMPLEADOS ---

@router.post("/empleados/")
def crear_empleado(empleado: schemas.EmpleadoCreate, db: Session = Depends(get_db)):
    nuevo_empleado = models.Empleado(nombre=empleado.nombre, documento=empleado.documento, puesto=empleado.puesto)
    db.add(nuevo_empleado)
    db.commit()
    db.refresh(nuevo_empleado)
    return nuevo_empleado

@router.get("/empleados/")
def obtener_empleados(db: Session = Depends(get_db)):
    return db.query(models.Empleado).all()

# --- RUTA DE ASISTENCIA (Lógica del QR) ---

@router.post("/asistencia/fichar")
def registrar_fichada(fichada: schemas.RegistroAsistenciaCreate, db: Session = Depends(get_db)):
    # 1. Buscar al empleado por el DNI (que viene del QR)
    empleado = db.query(models.Empleado).filter(models.Empleado.documento == fichada.documento).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado con ese QR")
        
    ahora = datetime.utcnow()
    fecha_hoy = ahora.date()
    
    # 2. Buscar si tiene una fichada de ENTRADA abierta el día de hoy
    fichada_abierta = db.query(models.RegistroAsistencia).filter(
        models.RegistroAsistencia.empleado_id == empleado.id,
        models.RegistroAsistencia.fecha == fecha_hoy,
        models.RegistroAsistencia.hora_salida == None
    ).first()
    
    if fichada_abierta:
        # SI TIENE ENTRADA ABIERTA, FICHAMOS SALIDA
        fichada_abierta.hora_salida = ahora
        
        # Calcular el tiempo trabajado
        diferencia = ahora - fichada_abierta.hora_entrada
        fichada_abierta.segundos_trabajados = int(diferencia.total_seconds())
        
        db.commit()
        db.refresh(fichada_abierta)
        
        horas_trabajadas = round(fichada_abierta.segundos_trabajados / 3600, 2)
        return {"status": "success", "mensaje": f"Salida registrada para {empleado.nombre}. Horas trabajadas hoy: {horas_trabajadas}"}
        
    else:
        # SI NO TIENE ENTRADA ABIERTA, FICHAMOS ENTRADA
        nueva_entrada = models.RegistroAsistencia(empleado_id=empleado.id, fecha=fecha_hoy, hora_entrada=ahora)
        db.add(nueva_entrada)
        db.commit()
        
        return {"status": "success", "mensaje": f"Entrada registrada para {empleado.nombre}"}

# --- RUTA PARA EL DASHBOARD: Obtener quién está trabajando ahora ---
@router.get("/asistencia/presentes")
def obtener_empleados_presentes(db: Session = Depends(get_db)):
    ahora = datetime.utcnow()
    fecha_hoy = ahora.date()
    
    # Buscamos registros de hoy sin hora de salida
    registros_abiertos = db.query(models.RegistroAsistencia).filter(
        models.RegistroAsistencia.fecha == fecha_hoy,
        models.RegistroAsistencia.hora_salida == None
    ).all()
    
    presentes = []
    for reg in registros_abiertos:
        presentes.append({
            "nombre": reg.empleado.nombre,
            "hora_entrada": reg.hora_entrada
        })
    return presentes

@router.put("/{empleado_id}")
def editar_empleado(empleado_id: int, empleado: schemas.EmpleadoCreate, db: Session = Depends(get_db)):
    emp = db.query(models.Empleado).filter(models.Empleado.id == empleado_id).first()
    if emp:
        emp.nombre = empleado.nombre
        emp.documento = empleado.documento
        emp.puesto = empleado.puesto
        db.commit()
        db.refresh(emp)
    return emp

@router.delete("/{empleado_id}")
def eliminar_empleado(empleado_id: int, db: Session = Depends(get_db)):
    emp = db.query(models.Empleado).filter(models.Empleado.id == empleado_id).first()
    if emp:
        db.delete(emp)
        db.commit()
    return {"status": "ok"}