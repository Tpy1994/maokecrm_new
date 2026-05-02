import datetime as _dt

from sqlmodel import Field, SQLModel

from app.models.user import new_uuid, utcnow


class ConsultationLog(SQLModel, table=True):
    __tablename__ = "consultation_logs"

    id: str = Field(default_factory=new_uuid, primary_key=True, max_length=36)
    customer_id: str = Field(foreign_key="customers.id", max_length=36)
    consultant_id: str = Field(foreign_key="users.id", max_length=36)
    log_date: _dt.date = Field(default_factory=_dt.date.today)
    duration: int = Field(default=0)
    content: str | None = Field(default=None)
    summary: str | None = Field(default=None)

    created_at: _dt.datetime = Field(default_factory=utcnow)
    updated_at: _dt.datetime = Field(default_factory=utcnow)
