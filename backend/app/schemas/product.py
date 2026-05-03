from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    name: str = Field(max_length=100)
    subtitle: str | None = Field(default=None, max_length=200)
    price: int = Field(default=0, ge=0)
    is_consultation: bool = False
    status: str = Field(default="active", max_length=20)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    subtitle: str | None = Field(default=None, max_length=200)
    price: int | None = Field(default=None, ge=0)
    is_consultation: bool | None = None
    status: str | None = Field(default=None, max_length=20)


class ProductOut(BaseModel):
    id: str
    name: str
    subtitle: str | None
    price: int
    is_consultation: bool
    status: str
    monthly_deal_count: int = 0
