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
from datetime import date

from sqlmodel import func

from app.models.consultant_customer import ConsultantCustomer
from app.models.consultation_log import ConsultationLog
from app.models.customer import Customer
from app.models.link_account import LinkAccount
from app.models.order import CustomerProduct
from app.models.order import Order
from app.models.product import Product
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


class AdminCustomerItemOut(BaseModel):
    customer_id: str
    customer_name: str
    phone: str
    customer_info: str
    wechat_name: str | None
    sales_name: str | None
    tags: list[TagOut]
    products: list[ProductOut]
    consultants: list[ConsultantBadgeOut]
    asset_status: str
    created_at: str


class AdminDashboardOut(BaseModel):
    sales_capacity: list[dict]
    source_channels: list[dict]
    product_deals: list[dict]
    consultant_delivery: list[dict]


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


@router.get("/customers", response_model=list[AdminCustomerItemOut])
async def admin_customers(
    keyword: str | None = Query(None),
    view: str = Query("all"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    customers_r = await db.execute(select(Customer).order_by(Customer.created_at.desc()))
    out: list[AdminCustomerItemOut] = []

    for c in customers_r.scalars().all():
        tags = await _build_tags(c.id, db)
        if keyword:
            k = keyword.strip().lower()
            if k and k not in c.name.lower() and not any(k in t.name.lower() for t in tags):
                continue

        products, _ = await _build_products(c.id, db)
        consultants = await _build_consultants(c.id, "", db)

        paid_r = await db.execute(
            select(CustomerProduct.id).where(
                CustomerProduct.customer_id == c.id,
                CustomerProduct.is_refunded.is_(False),
            )
        )
        has_deal = paid_r.first() is not None
        in_consulting = len(consultants) > 0

        if in_consulting:
            asset_status = "consulting"
        elif has_deal:
            asset_status = "dealed"
        else:
            asset_status = "normal"

        if view == "dealed" and not has_deal:
            continue
        if view == "consulting" and not in_consulting:
            continue

        sales_r = await db.execute(select(User.name).where(User.id == c.entry_user_id))
        sales_name = sales_r.scalar_one_or_none()
        link_r = await db.execute(select(LinkAccount.account_id).where(LinkAccount.id == c.link_account_id))
        wechat_name = link_r.scalar_one_or_none()

        out.append(
            AdminCustomerItemOut(
                customer_id=c.id,
                customer_name=c.name,
                phone=c.phone,
                customer_info=f"{c.industry or ''}{'-' if c.industry and c.region else ''}{c.region or ''}",
                wechat_name=wechat_name,
                sales_name=sales_name,
                tags=tags,
                products=products,
                consultants=consultants,
                asset_status=asset_status,
                created_at=c.created_at.isoformat(),
            )
        )

    return out


@router.get("/dashboard", response_model=AdminDashboardOut)
async def admin_dashboard(
    month: str | None = Query(None, description="YYYY-MM"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    today = date.today()
    if month:
        y, m = month.split("-")
        start = date(int(y), int(m), 1)
    else:
        start = date(today.year, today.month, 1)
    if start.month == 12:
        end = date(start.year + 1, 1, 1)
    else:
        end = date(start.year, start.month + 1, 1)

    sales_users_r = await db.execute(select(User).where(User.role == "sales"))
    sales_capacity: list[dict] = []
    for u in sales_users_r.scalars().all():
        new_customers_r = await db.execute(
            select(func.count(Customer.id)).where(
                Customer.entry_user_id == u.id,
                Customer.created_at >= start,
                Customer.created_at < end,
            )
        )
        order_cnt_r = await db.execute(
            select(func.count(Order.id)).where(
                Order.sales_user_id == u.id,
                Order.created_at >= start,
                Order.created_at < end,
                Order.refunded_at.is_(None),
            )
        )
        amount_r = await db.execute(
            select(func.coalesce(func.sum(Order.amount), 0)).where(
                Order.sales_user_id == u.id,
                Order.created_at >= start,
                Order.created_at < end,
                Order.refunded_at.is_(None),
            )
        )
        sales_capacity.append(
            {
                "user_id": u.id,
                "name": u.name,
                "new_customers": new_customers_r.scalar() or 0,
                "order_count": order_cnt_r.scalar() or 0,
                "deal_amount": int(amount_r.scalar() or 0),
            }
        )

    source_rows = await db.execute(
        select(Customer.industry, Customer.region, func.count(Customer.id))
        .where(Customer.created_at >= start, Customer.created_at < end)
        .group_by(Customer.industry, Customer.region)
        .order_by(func.count(Customer.id).desc())
    )
    source_channels = [
        {
            "source": f"{industry or ''}{'-' if industry and region else ''}{region or ''}" or "未标注",
            "count": cnt,
        }
        for industry, region, cnt in source_rows.all()
    ]

    product_rows = await db.execute(
        select(Product.id, Product.name, func.count(Order.id), func.coalesce(func.sum(Order.amount), 0))
        .join(Order, Order.product_id == Product.id)
        .where(
            Order.created_at >= start,
            Order.created_at < end,
            Order.refunded_at.is_(None),
        )
        .group_by(Product.id, Product.name)
        .order_by(func.count(Order.id).desc())
    )
    product_deals = [
        {"product_id": pid, "product_name": name, "order_count": cnt, "deal_amount": int(amount or 0)}
        for pid, name, cnt, amount in product_rows.all()
    ]

    consultant_rows = await db.execute(select(User).where(User.role == "consultant"))
    consultant_delivery: list[dict] = []
    for u in consultant_rows.scalars().all():
        service_cnt_r = await db.execute(
            select(func.count(func.distinct(ConsultantCustomer.customer_id))).where(
                ConsultantCustomer.consultant_id == u.id,
                ConsultantCustomer.status == "active",
            )
        )
        meeting_cnt_r = await db.execute(
            select(func.count(ConsultationLog.id)).where(
                ConsultationLog.consultant_id == u.id,
                ConsultationLog.log_date >= start,
                ConsultationLog.log_date < end,
            )
        )
        consultant_delivery.append(
            {
                "user_id": u.id,
                "name": u.name,
                "service_customers": service_cnt_r.scalar() or 0,
                "meetings_this_month": meeting_cnt_r.scalar() or 0,
            }
        )

    sales_capacity.sort(key=lambda i: (i["deal_amount"], i["order_count"]), reverse=True)
    consultant_delivery.sort(key=lambda i: (i["service_customers"], i["meetings_this_month"]), reverse=True)

    return AdminDashboardOut(
        sales_capacity=sales_capacity,
        source_channels=source_channels,
        product_deals=product_deals,
        consultant_delivery=consultant_delivery,
    )
