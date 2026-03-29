from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Crea un archivo llamado taller.db en la raíz del proyecto
SQLALCHEMY_DATABASE_URL = "sqlite:///./taller.db"

# connect_args={"check_same_thread": False} es clave en SQLite cuando usamos FastAPI
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()