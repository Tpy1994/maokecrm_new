from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.core.deps import get_db, require_role
from app.models.tag import TagCategory, Tag, CustomerTag
from app.schemas.tag import TagCategoryCreate, TagCategoryOut, TagCategoryUpdate, TagCreate, TagOut, TagUpdate

router = APIRouter(prefix="/tags", tags=["tags"])


def _clean_text(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    return cleaned


# --- Categories ---

@router.get("/categories", response_model=list[TagCategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    result = await db.execute(select(TagCategory).order_by(TagCategory.sort_order))
    return result.scalars().all()


@router.post("/categories", response_model=TagCategoryOut, status_code=201)
async def create_category(body: TagCategoryCreate, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    name = _clean_text(body.name)
    group = _clean_text(body.group)
    existing_result = await db.execute(
        select(TagCategory).where(
            TagCategory.group == group,
            TagCategory.name == name,
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Category name already exists in this group")
    category = TagCategory(name=name, group=group)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=TagCategoryOut)
async def update_category(category_id: str, body: TagCategoryUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    result = await db.execute(select(TagCategory).where(TagCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    update_data = body.model_dump(exclude_none=True)
    if "name" in update_data:
        update_data["name"] = _clean_text(update_data["name"])
    if "group" in update_data:
        update_data["group"] = _clean_text(update_data["group"])
    next_group = update_data.get("group", category.group)
    next_name = update_data.get("name", category.name)
    if next_name != category.name or next_group != category.group:
        existing_result = await db.execute(
            select(TagCategory).where(
                TagCategory.group == next_group,
                TagCategory.name == next_name,
                TagCategory.id != category_id,
            )
        )
        if existing_result.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Category name already exists in this group")
    for key, value in update_data.items():
        setattr(category, key, value)
    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=204)
async def delete_category(category_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    result = await db.execute(select(TagCategory).where(TagCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    tags_result = await db.execute(select(Tag).where(Tag.category_id == category_id))
    tags = tags_result.scalars().all()
    tag_ids = [item.id for item in tags]
    if tag_ids:
        customer_tag_result = await db.execute(select(CustomerTag).where(CustomerTag.tag_id.in_(tag_ids)))
        customer_tags = customer_tag_result.scalars().all()
        for customer_tag in customer_tags:
            await db.delete(customer_tag)
        for tag in tags:
            await db.delete(tag)

    await db.delete(category)
    await db.commit()


# --- Tags ---

@router.get("/categories/{category_id}/tags", response_model=list[TagOut])
async def list_tags(category_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    tags_result = await db.execute(select(Tag).where(Tag.category_id == category_id).order_by(Tag.name))
    tags = tags_result.scalars().all()
    out = []
    for tag in tags:
        count_result = await db.execute(select(func.count()).select_from(CustomerTag).where(CustomerTag.tag_id == tag.id))
        cnt = count_result.scalar() or 0
        out.append(TagOut(id=tag.id, name=tag.name, category_id=tag.category_id, tag_count=cnt))
    return out


@router.post("/categories/{category_id}/tags", response_model=TagOut, status_code=201)
async def create_tag(category_id: str, body: TagCreate, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    tag_name = _clean_text(body.name)
    category_result = await db.execute(select(TagCategory).where(TagCategory.id == category_id))
    category = category_result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    existing_result = await db.execute(
        select(Tag).where(
            Tag.category_id == category_id,
            Tag.name == tag_name,
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Tag name already exists in this category")

    tag = Tag(name=tag_name, category_id=category_id)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return TagOut(id=tag.id, name=tag.name, category_id=tag.category_id, tag_count=0)


@router.put("/tags/{tag_id}", response_model=TagOut)
async def update_tag(tag_id: str, body: TagUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    update_data = body.model_dump(exclude_none=True)
    if "name" in update_data:
        update_data["name"] = _clean_text(update_data["name"])
    next_name = update_data.get("name", tag.name)
    next_category_id = update_data.get("category_id", tag.category_id)

    if "category_id" in update_data:
        category_result = await db.execute(select(TagCategory).where(TagCategory.id == next_category_id))
        if not category_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Category not found")

    if next_name != tag.name or next_category_id != tag.category_id:
        existing_result = await db.execute(
            select(Tag).where(
                Tag.category_id == next_category_id,
                Tag.name == next_name,
                Tag.id != tag_id,
            )
        )
        if existing_result.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Tag name already exists in this category")

    for key, value in update_data.items():
        setattr(tag, key, value)

    await db.commit()
    await db.refresh(tag)
    count_result = await db.execute(select(func.count()).select_from(CustomerTag).where(CustomerTag.tag_id == tag.id))
    cnt = count_result.scalar() or 0
    return TagOut(id=tag.id, name=tag.name, category_id=tag.category_id, tag_count=cnt)


@router.delete("/tags/{tag_id}", status_code=204)
async def delete_tag(tag_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    customer_tag_result = await db.execute(select(CustomerTag).where(CustomerTag.tag_id == tag_id))
    customer_tags = customer_tag_result.scalars().all()
    for customer_tag in customer_tags:
        await db.delete(customer_tag)

    await db.delete(tag)
    await db.commit()
