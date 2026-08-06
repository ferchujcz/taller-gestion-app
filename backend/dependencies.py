from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
import jwt

SECRET_KEY = "mi_clave_secreta_taller_360_super_segura"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 720 # El token dura 12 horas (una jornada laboral)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

def obtener_taller_actual(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        taller_id: int = payload.get("taller_id")
        
        if taller_id is None:
            raise HTTPException(status_code=401, detail="Token inválido: No hay taller asignado")
        return taller_id
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="El token expiró. Vuelva a iniciar sesión.")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Credenciales inválidas")