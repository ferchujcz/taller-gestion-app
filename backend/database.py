import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Busca la URL en las variables de entorno (la nube). Si no existe, usa un archivo local.
# Usamos un get() seguro para evitar strings vacíos
url_env = os.getenv("DATABASE_URL")
if not url_env or url_env.strip() == "":
    SQLALCHEMY_DATABASE_URL = "sqlite:///./taller_local.db"
else:
    SQLALCHEMY_DATABASE_URL = url_env

# Ajuste necesario porque Render/Neon usan Postgres
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Si es SQLite local, necesita check_same_thread. Si es Postgres, no.
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()