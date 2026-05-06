from pydantic import BaseModel, Field


class TagCategoryCreate(BaseModel):
    name: str = Field(max_length=50)
    group: str = Field(max_length=20)


class TagCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=7)
    sort_order: int | None = None
    group: str | None = Field(default=None, max_length=20)


class TagCategoryOut(BaseModel):
    id: str
    name: str
    group: str
    color: str
    sort_order: int


class TagCreate(BaseModel):
    name: str = Field(max_length=50)


class TagUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=50)
    category_id: str | None = Field(default=None, max_length=36)


class TagOut(BaseModel):
    id: str
    name: str
    category_id: str | None = None
    tag_count: int | None = None
