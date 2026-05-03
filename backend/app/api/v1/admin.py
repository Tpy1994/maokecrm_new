from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from sqlalchemy import and_

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
from app.models.tag import CustomerTag, Tag, TagCategory
from app.models.user import User
from app.models.customer_course_enrollment import CustomerCourseEnrollment

router = APIRouter(prefix="/admin", tags=["admin"])


class AdminPoolItemOut(BaseModel):
    pool_id: str | None
    customer_id: str
    customer_name: str
    customer_info: str
    tags: list[TagOut]
    sales_name: str | None
    entered_days: int
    claim_status: str
    pool_entered_at: str


class AdminPoolSummaryOut(BaseModel):
    pending: int
    active: int
    ended: int


class AdminPoolOut(BaseModel):
    summary: AdminPoolSummaryOut
    items: list[AdminPoolItemOut]


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


class AdminCourseStatusUpdateIn(BaseModel):
    status: str


ADMIN_COURSE_STATUSES = {
    "admin_marked_completed",
    "admin_marked_completed_refunded",
}


@router.get("/pool", response_model=AdminPoolOut)
async def admin_pool(
    status: str = Query("pending"),
    keyword: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    if status not in {"pending", "active", "ended"}:
        raise HTTPException(400, "invalid status")

    summary_rows = await db.execute(
        select(ConsultantCustomer.status, func.count(ConsultantCustomer.id))
        .where(ConsultantCustomer.status.in_(["pending", "active", "ended"]))
        .group_by(ConsultantCustomer.status)
    )
    summary_map = {s: int(c) for s, c in summary_rows.all()}

    rows = await db.execute(
        select(ConsultantCustomer, Customer, User.name)
        .join(Customer, ConsultantCustomer.customer_id == Customer.id)
        .join(User, Customer.entry_user_id == User.id, isouter=True)
        .where(ConsultantCustomer.status == status)
        .order_by(ConsultantCustomer.created_at.asc())
    )

    out: list[AdminPoolItemOut] = []
    now = datetime.utcnow()
    for rel, customer, sales_name in rows.all():
        tag_rows = await db.execute(
            select(Tag, TagCategory)
            .join(TagCategory, Tag.category_id == TagCategory.id)
            .join(CustomerTag, and_(CustomerTag.tag_id == Tag.id, CustomerTag.customer_id == customer.id))
            .order_by(TagCategory.sort_order.asc(), Tag.name.asc())
        )
        tags = [TagOut(id=t.id, name=t.name, color=tc.color) for t, tc in tag_rows.all()]

        if keyword:
            k = keyword.strip().lower()
            if k:
                if k not in customer.name.lower() and k not in customer.phone.lower() and not any(k in t.name.lower() for t in tags):
                    continue

        entered_days = max(0, (now.date() - rel.created_at.date()).days)
        claim_status = "未认领" if rel.status == "pending" else ("进行中" if rel.status == "active" else "已结束")

        out.append(
            AdminPoolItemOut(
                pool_id=rel.id,
                customer_id=customer.id,
                customer_name=customer.name,
                customer_info=f"{customer.industry or ''} · {customer.region or ''}".strip(" ·"),
                tags=tags,
                sales_name=sales_name,
                entered_days=entered_days,
                claim_status=claim_status,
                pool_entered_at=rel.created_at.isoformat(),
            )
        )

    return AdminPoolOut(
        summary=AdminPoolSummaryOut(
            pending=summary_map.get("pending", 0),
            active=summary_map.get("active", 0),
            ended=summary_map.get("ended", 0),
        ),
        items=out,
    )


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


@router.put("/customers/{customer_id}/courses/{enrollment_id}/status")
async def update_admin_course_status(
    customer_id: str,
    enrollment_id: str,
    body: AdminCourseStatusUpdateIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    if body.status not in ADMIN_COURSE_STATUSES:
        raise HTTPException(400, "管理员仅可设置后2种状态")

    row = await db.execute(
        select(CustomerCourseEnrollment).where(
            CustomerCourseEnrollment.id == enrollment_id,
            CustomerCourseEnrollment.customer_id == customer_id,
        )
    )
    enrollment = row.scalar_one_or_none()
    if enrollment is None:
        raise HTTPException(404, "课程记录不存在")

    enrollment.status = body.status
    enrollment.status_updated_by = current_user.id
    enrollment.status_updated_role = "admin"
    enrollment.status_updated_at = datetime.utcnow()
    enrollment.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "ok"}
