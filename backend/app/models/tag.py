from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.user import new_uuid, utcnow


class TagCategory(SQLModel, table=True):
    __tablename__ = "tag_categories"

    id: str = Field(default_factory=new_uuid, primary_key=True, max_length=36)
    name: str = Field(max_length=50)
    group: str = Field(max_length=20)
    color: str = Field(default="#1890ff", max_length=7)
    sort_order: int = Field(default=0)

    created_at: datetime = Field(default_factory=utcnow)


class Tag(SQLModel, table=True):
    __tablename__ = "tags"

    id: str = Field(default_factory=new_uuid, primary_key=True, max_length=36)
    name: str = Field(max_length=50)
    category_id: str = Field(foreign_key="tag_categories.id", max_length=36)

    created_at: datetime = Field(default_factory=utcnow)


class CustomerTag(SQLModel, table=True):
    __tablename__ = "customer_tags"

    customer_id: str = Field(foreign_key="customers.id", primary_key=True, max_length=36)
    tag_id: str = Field(foreign_key="tags.id", primary_key=True, max_length=36)
