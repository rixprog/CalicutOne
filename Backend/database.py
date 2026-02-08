from sqlalchemy import create_engine, Column, Integer, String, Boolean, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./users.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String, unique=True, index=True)
    aadhar = Column(String, unique=True)
    blood_group = Column(String)
    profession = Column(String)
    
    # Status: "active" (using app), "inactive" (not using)
    status = Column(String, default="active") 
    
    hashed_password = Column(String)

Base.metadata.create_all(bind=engine)
