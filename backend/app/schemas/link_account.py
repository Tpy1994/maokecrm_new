from pydantic import BaseModel, Field


class LinkAccountCreate(BaseModel):
    account_id: str = Field(max_length=200)
    owner_id: str = Field(max_length=36)


class LinkAccountTransfer(BaseModel):
    target_user_id: str = Field(max_length=36)
    reason: str = Field(max_length=500)


class LinkAccountOut(BaseModel):
    id: str
    account_id: str
    owner_id: str
    owner_name: str | None = None
    customer_count: int | None = None
    created_at: str | None = None
