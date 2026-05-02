import uuid as _uuid
from datetime import datetime

from sqlmodel import Field, SQLModel


def new_uuid() -> str:
    return str(_uuid.uuid4())


def utcnow() -> datetime:
    return datetime.utcnow()


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(default_factory=new_uuid, primary_key=True, max_length=36)
    name: str = Field(max_length=50)
    phone: str = Field(max_length=20, unique=True, index=True)
    role: str = Field(max_length=20)
    status: str = Field(default="active", max_length=20)
    hired_at: datetime | None = Field(default=None)
    hashed_password: str = Field(max_length=128)

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
