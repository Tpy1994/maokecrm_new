from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.api.v1.consultant import (
    ConsultantBadgeOut,
    ProductOut,
    TagOut,
    _build_consultants,
    _build_products,
    _build_tags,
)
from app.core.deps import get_db, require_role
from app.models.consultant_customer import ConsultantCustomer
from app.models.customer import Customer
from app.models.link_account import LinkAccount
from app.models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminPoolItemOut(BaseModel):
    pool_id: str
    customer_id: str
    customer_name: str
    phone: str
    wechat_name: str | None
    source_channel: str | None
    deal_product: str | None
    deal_amount: int | None
    pool_entered_at: str
    tags: list[TagOut]
    products: list[ProductOut]
    sales_name: str | None
    consultants: list[ConsultantBadgeOut]
    service_status: str
    consultant_count: int
    can_claim: bool
    can_join: bool


@router.get("/pool", response_model=list[AdminPoolItemOut])
async def admin_pool(
    keyword: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    customers_r = await db.execute(select(Customer).order_by(Customer.created_at.desc()))
    out: list[AdminPoolItemOut] = []

    for c in customers_r.scalars().all():
        tags = await _build_tags(c.id, db)
        if keyword:
            k = keyword.strip().lower()
            if k and k not in c.name.lower() and not any(k in t.name.lower() for t in tags):
                continue

        products, _ = await _build_products(c.id, db)
        consultants = await _build_consultants(c.id, "", db)

        pending_r = await db.execute(
            select(ConsultantCustomer)
            .where(ConsultantCustomer.customer_id == c.id, ConsultantCustomer.status == "pending")
            .order_by(ConsultantCustomer.created_at.asc())
        )
        pending_rel = pending_r.scalars().first()
        if pending_rel:
            pool_rel = pending_rel
        else:
            any_rel_r = await db.execute(
                select(ConsultantCustomer)
                .where(
                    ConsultantCustomer.customer_id == c.id,
                    ConsultantCustomer.status.in_(["active", "ended"]),
                )
                .order_by(ConsultantCustomer.created_at.asc())
            )
            pool_rel = any_rel_r.scalars().first()

        pool_entered_at = (pool_rel.created_at if pool_rel else c.created_at).isoformat()
        pool_id = pool_rel.id if pool_rel else ""
        consultant_count = len(consultants)
        service_status = "unclaimed" if consultant_count == 0 else "serving"

        sales_r = await db.execute(select(User.name).where(User.id == c.entry_user_id))
        sales_name = sales_r.scalar_one_or_none()
        link_r = await db.execute(select(LinkAccount.account_id).where(LinkAccount.id == c.link_account_id))
        wechat_name = link_r.scalar_one_or_none()
        source_channel = c.industry or c.region or None
        deal_product = products[0].product_name if products else None

        out.append(
            AdminPoolItemOut(
                pool_id=pool_id,
                customer_id=c.id,
                customer_name=c.name,
                phone=c.phone,
                wechat_name=wechat_name,
                source_channel=source_channel,
                deal_product=deal_product,
                deal_amount=None,
                pool_entered_at=pool_entered_at,
                tags=tags,
                products=products,
                sales_name=sales_name,
                consultants=consultants,
                service_status=service_status,
                consultant_count=consultant_count,
                can_claim=False,
                can_join=False,
            )
        )

    out.sort(key=lambda i: (0 if i.service_status == "unclaimed" else 1, i.pool_entered_at))
    return out
