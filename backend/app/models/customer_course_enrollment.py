from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.user import new_uuid, utcnow


class CustomerCourseEnrollment(SQLModel, table=True):
    __tablename__ = "customer_course_enrollments"

    id: str = Field(default_factory=new_uuid, primary_key=True, max_length=36)
    customer_id: str = Field(foreign_key="customers.id", max_length=36, index=True)
    order_id: str = Field(foreign_key="orders.id", max_length=36, index=True)
    product_id: str = Field(foreign_key="products.id", max_length=36, index=True)
    amount_paid: int = Field(default=0)
    status: str = Field(default="purchased_not_started", max_length=50, index=True)
    status_updated_by: str | None = Field(default=None, foreign_key="users.id", max_length=36)
    status_updated_role: str | None = Field(default=None, max_length=20)
    status_updated_at: datetime | None = Field(default=None)

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
