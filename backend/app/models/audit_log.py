from datetime import datetime
from decimal import Decimal

from sqlalchemy import Column, Numeric
from sqlmodel import Field, SQLModel

from app.models.user import new_uuid, utcnow


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: str = Field(default_factory=new_uuid, primary_key=True, max_length=36)
    resource_type: str = Field(max_length=40, index=True)
    resource_id: str = Field(max_length=36, index=True)
    customer_id: str | None = Field(default=None, foreign_key="customers.id", max_length=36, index=True)
    action: str = Field(max_length=60, index=True)
    changes: str | None = Field(default=None)
    amount_delta: Decimal | None = Field(default=None, sa_column=Column(Numeric(12, 2), nullable=True))
    operator_user_id: str | None = Field(default=None, foreign_key="users.id", max_length=36, index=True)
    operator_role: str | None = Field(default=None, max_length=20)
    note: str | None = Field(default=None)
    related_event_id: str | None = Field(default=None, max_length=36)
    created_at: datetime = Field(default_factory=utcnow, index=True)
