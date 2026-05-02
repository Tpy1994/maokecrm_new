from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.user import new_uuid, utcnow


class Order(SQLModel, table=True):
    __tablename__ = "orders"

    id: str = Field(default_factory=new_uuid, primary_key=True, max_length=36)
    customer_id: str = Field(foreign_key="customers.id", max_length=36)
    product_id: str = Field(foreign_key="products.id", max_length=36)
    sales_user_id: str = Field(foreign_key="users.id", max_length=36)
    amount: int = Field(default=0)
    refunded_at: datetime | None = Field(default=None)

    created_at: datetime = Field(default_factory=utcnow)


class CustomerProduct(SQLModel, table=True):
    __tablename__ = "customer_products"

    id: str = Field(default_factory=new_uuid, primary_key=True, max_length=36)
    customer_id: str = Field(foreign_key="customers.id", max_length=36)
    product_id: str = Field(foreign_key="products.id", max_length=36)
    order_id: str = Field(foreign_key="orders.id", max_length=36)
    is_refunded: bool = Field(default=False)

    created_at: datetime = Field(default_factory=utcnow)
