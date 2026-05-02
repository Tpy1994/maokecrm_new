from pydantic import BaseModel, Field


class TagCategoryCreate(BaseModel):
    name: str = Field(max_length=50)
    group: str = Field(max_length=20)


class TagCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=7)
    sort_order: int | None = None


class TagCategoryOut(BaseModel):
    id: str
    name: str
    group: str
    color: str
    sort_order: int


class TagCreate(BaseModel):
    name: str = Field(max_length=50)


class TagOut(BaseModel):
    id: str
    name: str
    tag_count: int | None = None
