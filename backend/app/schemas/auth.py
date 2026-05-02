from pydantic import BaseModel, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    phone: str = Field(max_length=20)
    password: str = Field(max_length=128)


class UserOut(BaseModel):
    id: str
    name: str
    phone: str
    role: str
    status: str
