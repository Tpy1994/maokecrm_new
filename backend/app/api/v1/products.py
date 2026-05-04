from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.core.deps import get_current_user, get_db, require_role
from app.models.product import Product
from app.models.order import Order
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


@router.get("/", response_model=list[ProductOut])
async def list_products(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("admin", "sales", "consultant")),
):
    result = await db.execute(select(Product).order_by(Product.status.desc(), Product.name))
    products = result.scalars().all()

    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    if now.month == 12:
        month_end = datetime(now.year + 1, 1, 1)
    else:
        month_end = datetime(now.year, now.month + 1, 1)

    monthly_rows = await db.execute(
        select(Order.product_id, func.count(Order.id))
        .where(
            Order.created_at >= month_start,
            Order.created_at < month_end,
            Order.refunded_at.is_(None),
        )
        .group_by(Order.product_id)
    )
    monthly_map = {pid: cnt for pid, cnt in monthly_rows.all()}

    out: list[ProductOut] = []
    for p in products:
        out.append(
            ProductOut(
                id=p.id,
                name=p.name,
                subtitle=p.subtitle,
                price=p.price,
                is_consultation=p.is_consultation,
                status=p.status,
                monthly_deal_count=int(monthly_map.get(p.id, 0)),
            )
        )
    return out


@router.get("", response_model=list[ProductOut], include_in_schema=False)
async def list_products_no_slash(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("admin", "sales", "consultant")),
):
    return await list_products(db, _)


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/", response_model=ProductOut, status_code=201)
async def create_product(body: ProductCreate, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    product = Product(**body.model_dump())
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.put("/{product_id}", response_model=ProductOut)
async def update_product(product_id: str, body: ProductUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    update_data = body.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(product, key, value)
    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=204)
async def delete_product(product_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.delete(product)
    await db.commit()
