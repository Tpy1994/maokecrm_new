from datetime import datetime
from decimal import Decimal

from sqlalchemy import Column, Numeric
from sqlmodel import Field, SQLModel

from app.models.user import new_uuid, utcnow


class TuitionGiftRequest(SQLModel, table=True):
    __tablename__ = "tuition_gift_requests"

    id: str = Field(default_factory=new_uuid, primary_key=True, max_length=36)
    customer_id: str = Field(foreign_key="customers.id", max_length=36, index=True)
    sales_user_id: str = Field(foreign_key="users.id", max_length=36, index=True)
    amount: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=False, server_default="0"))
    sales_note: str | None = Field(default=None)
    admin_note: str | None = Field(default=None)
    status: str = Field(default="pending", max_length=20, index=True)
    reviewed_by_user_id: str | None = Field(default=None, foreign_key="users.id", max_length=36, index=True)
    reviewed_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow, index=True)
    updated_at: datetime = Field(default_factory=utcnow)
