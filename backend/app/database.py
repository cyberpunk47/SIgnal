from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


DATABASE_URL = "sqlite:///./signal.db"


# Database engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)


# Base class for all SQLAlchemy models
class Base(DeclarativeBase):
    pass


# Database session factory
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


# Dependency used by FastAPI routes
def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()