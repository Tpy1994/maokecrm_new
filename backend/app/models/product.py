from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.user import new_uuid, utcnow


class Product(SQLModel, table=True):
    __tablename__ = "products"

    id: str = Field(default_factory=new_uuid, primary_key=True, max_length=36)
    name: str = Field(max_length=100)
    subtitle: str | None = Field(default=None, max_length=200)
    price: int = Field(default=0)
    is_consultation: bool = Field(default=False)
    status: str = Field(default="active", max_length=20)

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
