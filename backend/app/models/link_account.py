from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.user import new_uuid, utcnow


class LinkAccount(SQLModel, table=True):
    __tablename__ = "link_accounts"

    id: str = Field(default_factory=new_uuid, primary_key=True, max_length=36)
    account_id: str = Field(max_length=200, unique=True, index=True)
    owner_id: str = Field(foreign_key="users.id", max_length=36)
    last_transfer_at: datetime | None = Field(default=None)
    last_transfer_from_owner_name: str | None = Field(default=None, max_length=50)

    created_at: datetime = Field(default_factory=utcnow)
