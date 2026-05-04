from datetime import datetime
from decimal import Decimal

from sqlalchemy import Column, Numeric
from sqlmodel import Field, SQLModel

from app.models.user import new_uuid, utcnow


class Order(SQLModel, table=True):
    __tablename__ = "orders"

    id: str = Field(default_factory=new_uuid, primary_key=True, max_length=36)
    customer_id: str = Field(foreign_key="customers.id", max_length=36)
    product_id: str = Field(foreign_key="products.id", max_length=36)
    sales_user_id: str = Field(foreign_key="users.id", max_length=36)
    amount: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=False, server_default="0"))
    list_price: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=False, server_default="0"))
    deal_price: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=False, server_default="0"))
    refund_total: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(12, 2), nullable=False, server_default="0"))
    status: str = Field(default="active", max_length=30)
    refunded_at: datetime | None = Field(default=None)

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class CustomerProduct(SQLModel, table=True):
    __tablename__ = "customer_products"

    id: str = Field(default_factory=new_uuid, primary_key=True, max_length=36)
    customer_id: str = Field(foreign_key="customers.id", max_length=36)
    product_id: str = Field(foreign_key="products.id", max_length=36)
    order_id: str = Field(foreign_key="orders.id", max_length=36)
    is_refunded: bool = Field(default=False)

    created_at: datetime = Field(default_factory=utcnow)
