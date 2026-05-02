from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.user import new_uuid, utcnow


class Customer(SQLModel, table=True):
    __tablename__ = "customers"

    id: str = Field(default_factory=new_uuid, primary_key=True, max_length=36)
    name: str = Field(max_length=50)
    phone: str = Field(max_length=20)
    industry: str | None = Field(default=None, max_length=50)
    region: str | None = Field(default=None, max_length=50)
    link_account_id: str = Field(foreign_key="link_accounts.id", max_length=36)
    entry_user_id: str = Field(foreign_key="users.id", max_length=36)
    last_active_at: datetime | None = Field(default=None)

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
