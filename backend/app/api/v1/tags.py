from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.core.deps import get_db, require_role
from app.models.tag import TagCategory, Tag, CustomerTag
from app.schemas.tag import TagCategoryCreate, TagCategoryOut, TagCategoryUpdate, TagCreate, TagOut

router = APIRouter(prefix="/tags", tags=["tags"])


# --- Categories ---

@router.get("/categories", response_model=list[TagCategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    result = await db.execute(select(TagCategory).order_by(TagCategory.sort_order))
    return result.scalars().all()


@router.post("/categories", response_model=TagCategoryOut, status_code=201)
async def create_category(body: TagCategoryCreate, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    category = TagCategory(**body.model_dump())
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
        out.append(TagOut(id=tag.id, name=tag.name, tag_count=cnt))
    return out


@router.post("/categories/{category_id}/tags", response_model=TagOut, status_code=201)
async def create_tag(category_id: str, body: TagCreate, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    tag = Tag(name=body.name, category_id=category_id)
    db.add(tag)
    await db.commit()
    await db.refresh(tag)
    return TagOut(id=tag.id, name=tag.name, tag_count=0)


@router.delete("/tags/{tag_id}", status_code=204)
async def delete_tag(tag_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    tag = result.scalar_one_or_none()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    await db.delete(tag)
    await db.commit()
