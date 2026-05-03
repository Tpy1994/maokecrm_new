import datetime as _dt

from sqlmodel import Field, SQLModel

from app.models.user import new_uuid, utcnow


class ConsultantCustomer(SQLModel, table=True):
    __tablename__ = "consultant_customers"

    id: str = Field(default_factory=new_uuid, primary_key=True, max_length=36)
    consultant_id: str | None = Field(default=None, foreign_key="users.id", max_length=36)
    customer_id: str = Field(foreign_key="customers.id", max_length=36)
    status: str = Field(default="pending", max_length=20)
    start_date: _dt.date | None = Field(default=None)
    end_date: _dt.date | None = Field(default=None)
    next_consultation: _dt.datetime | None = Field(default=None)
    note: str | None = Field(default=None)
    consultation_count: int = Field(default=0)

    created_at: _dt.datetime = Field(default_factory=utcnow)
    updated_at: _dt.datetime = Field(default_factory=utcnow)
