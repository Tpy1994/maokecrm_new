from pydantic import BaseModel


class UserCreate(BaseModel):
    name: str
    phone: str
    password: str
    role: str
    hired_at: str | None = None


class UserUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    password: str | None = None
    role: str | None = None
    status: str | None = None
    hired_at: str | None = None


class UserOut(BaseModel):
    id: str
    name: str
    phone: str
    role: str
    status: str
    hired_at: str | None
    wechat_count: int | None = None
    customer_count: int | None = None
