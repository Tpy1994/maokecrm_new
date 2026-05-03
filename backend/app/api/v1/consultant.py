from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import and_, func, select

from app.core.deps import get_db, require_role
from app.models.consultant_customer import ConsultantCustomer
from app.models.consultation_log import ConsultationLog
from app.models.customer import Customer
from app.models.link_account import LinkAccount
from app.models.order import CustomerProduct
from app.models.product import Product
from app.models.tag import CustomerTag, Tag, TagCategory
from app.models.user import User

router = APIRouter(prefix="/consultant", tags=["consultant"])


class TagOut(BaseModel):
    id: str
    name: str
    color: str


class ProductOut(BaseModel):
    product_id: str
    product_name: str
    is_refunded: bool


class ConsultantBadgeOut(BaseModel):
    consultant_id: str
    consultant_name: str
    is_me: bool


class ConsultantCustomerOut(BaseModel):
    relation_id: str
    customer_id: str
    customer_name: str
    customer_info: str
    tags: list[TagOut]
    products: list[ProductOut]
    note: str | None
    next_consultation: str | None
    next_consultation_status: str
    next_consultation_label: str
    period_label: str
    period_status: str
    consultation_count: int
    is_refunded_customer: bool
    row_tone: str
    collaborators: list[ConsultantBadgeOut]


class PoolItemOut(BaseModel):
    customer_id: str
    customer_name: str
    customer_info: str
    tags: list[TagOut]
    products: list[ProductOut]
    sales_name: str | None
    consultants: list[ConsultantBadgeOut]
    pool_status: str
    pool_age_label: str
    pool_sort_time: str


class LogItemOut(BaseModel):
    id: str
    customer_id: str
    consultant_id: str
    consultant_name: str
    is_me: bool
    log_date: str
    duration: int
    summary: str | None
    content: str | None
    created_at: str


class UpdateConsultantCustomerIn(BaseModel):
    note: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    next_consultation: str | None = None


class UpsertLogIn(BaseModel):
    log_date: str
    duration: int
    content: str | None = None
    summary: str | None = None


class DashboardOut(BaseModel):
    service_customers: int
    co_service_customers: int
    meetings_this_month: int
    meetings_last_month: int
    active_customers_with_meeting_this_month: int
    active_customers_without_meeting_this_month: int
    avg_meeting_per_service_customer: float
    total_meetings: int
    label_distribution: list[dict]


class TagAssignIn(BaseModel):
    tag_id: str


def _customer_info(customer: Customer) -> str:
    industry = customer.industry or ""
    region = customer.region or ""
    if industry and region:
        return f"{industry}·{region}"
    return industry or region


def _dt_status(next_at: datetime | None) -> tuple[str, str, str]:
    if next_at is None:
        return "unset", "未设置", "normal"

    now = datetime.utcnow()
    today = now.date()
    d = next_at.date()
    if d < today:
        days = (today - d).days
        return "overdue", f"已过期\n{days}天", "danger"
    if d == today:
        return "today", f"今天\n{next_at.strftime('%H:%M')}", "info"

    days = (d - today).days
    if days <= 2:
        return "soon", f"{next_at.strftime('%m/%d')}\n{days}天后", "warn"
    return "future", f"{next_at.strftime('%m/%d')}\n{days}天后", "normal"


def _period_status(start: date | None, end: date | None) -> tuple[str, str]:
    if not start or not end:
        return "进行中", "active"

    today = date.today()
    if today > end:
        return "已超期", "overdue"

    remain = (end - today).days
    if remain <= 30:
        return "临近到期", "near_expiry"
    return "进行中", "active"


async def _build_tags(customer_id: str, db: AsyncSession) -> list[TagOut]:
    rows = await db.execute(
        select(Tag, TagCategory)
        .join(TagCategory, Tag.category_id == TagCategory.id)
        .join(CustomerTag, and_(CustomerTag.tag_id == Tag.id, CustomerTag.customer_id == customer_id))
        .order_by(Tag.name)
    )
    return [TagOut(id=t.id, name=t.name, color=tc.color) for t, tc in rows.all()]


async def _build_products(customer_id: str, db: AsyncSession) -> tuple[list[ProductOut], bool]:
    rows = await db.execute(
        select(CustomerProduct, Product)
        .join(Product, Product.id == CustomerProduct.product_id)
        .where(CustomerProduct.customer_id == customer_id)
        .order_by(Product.name)
    )
    items: list[ProductOut] = []
    refunded = False
    for cp, p in rows.all():
        if cp.is_refunded:
            refunded = True
        items.append(
            ProductOut(
                product_id=p.id,
                product_name=p.name,
                is_refunded=cp.is_refunded,
            )
        )
    return items, refunded


async def _build_consultants(customer_id: str, current_user_id: str, db: AsyncSession) -> list[ConsultantBadgeOut]:
    rows = await db.execute(
        select(ConsultantCustomer, User)
        .join(User, User.id == ConsultantCustomer.consultant_id)
        .where(
            ConsultantCustomer.customer_id == customer_id,
            ConsultantCustomer.status == "active",
            ConsultantCustomer.consultant_id.is_not(None),
        )
        .order_by(User.name)
    )
    return [
        ConsultantBadgeOut(
            consultant_id=u.id,
            consultant_name=u.name,
            is_me=(u.id == current_user_id),
        )
        for _, u in rows.all()
    ]


async def _ensure_access(customer_id: str, current_user: User, db: AsyncSession) -> ConsultantCustomer:
    row = await db.execute(
        select(ConsultantCustomer).where(
            ConsultantCustomer.customer_id == customer_id,
            ConsultantCustomer.consultant_id == current_user.id,
            ConsultantCustomer.status == "active",
        )
    )
    relation = row.scalar_one_or_none()
    if relation is None:
        raise HTTPException(403, "你不是该客户的在服务咨询师")
    return relation


async def _ensure_consultant_tag(tag_id: str, db: AsyncSession) -> Tag:
    row = await db.execute(
        select(Tag, TagCategory)
        .join(TagCategory, Tag.category_id == TagCategory.id)
        .where(Tag.id == tag_id)
    )
    pair = row.first()
    if pair is None:
        raise HTTPException(404, "标签不存在")
    tag, category = pair
    if category.group != "consultant":
        raise HTTPException(403, "仅允许操作咨询师标签")
    return tag


@router.get("/customers", response_model=list[ConsultantCustomerOut])
async def consultant_customers(
    keyword: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("consultant")),
):
    rows = await db.execute(
        select(ConsultantCustomer, Customer)
        .join(Customer, Customer.id == ConsultantCustomer.customer_id)
        .where(
            ConsultantCustomer.consultant_id == current_user.id,
            ConsultantCustomer.status == "active",
        )
        .order_by(ConsultantCustomer.next_consultation.is_(None), ConsultantCustomer.next_consultation.asc(), Customer.created_at.desc())
    )

    out: list[ConsultantCustomerOut] = []
    for rel, c in rows.all():
        tags = await _build_tags(c.id, db)
        if keyword:
            k = keyword.strip().lower()
            if k and k not in c.name.lower() and not any(k in t.name.lower() for t in tags):
                continue

        products, refunded = await _build_products(c.id, db)
        logs_count_r = await db.execute(
            select(func.count(ConsultationLog.id)).where(
                ConsultationLog.customer_id == c.id,
                ConsultationLog.consultant_id == current_user.id,
            )
        )
        cnt = logs_count_r.scalar() or 0
        collaborators = await _build_consultants(c.id, current_user.id, db)

        status_key, status_label, row_tone = _dt_status(rel.next_consultation)
        period_state, period_key = _period_status(rel.start_date, rel.end_date)
        period = f"{rel.start_date.strftime('%m/%d') if rel.start_date else '--/--'}-{rel.end_date.strftime('%m/%d') if rel.end_date else '--/--'}"
        period_label = f"{period}\n{period_state}"

        if refunded:
            period_label = f"{period}\n已退款"
            period_key = "refunded"

        out.append(
            ConsultantCustomerOut(
                relation_id=rel.id,
                customer_id=c.id,
                customer_name=c.name,
                customer_info=_customer_info(c),
                tags=tags,
                products=products,
                note=rel.note,
                next_consultation=rel.next_consultation.isoformat() if rel.next_consultation else None,
                next_consultation_status=status_key,
                next_consultation_label=status_label,
                period_label=period_label,
                period_status=period_key,
                consultation_count=cnt,
                is_refunded_customer=refunded,
                row_tone=row_tone if not refunded else "muted",
                collaborators=collaborators,
            )
        )

    return out


@router.get("/tags")
async def consultant_tags(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("consultant")),
):
    rows = await db.execute(
        select(Tag, TagCategory)
        .join(TagCategory, Tag.category_id == TagCategory.id)
        .where(TagCategory.group == "consultant")
        .order_by(TagCategory.sort_order, Tag.name)
    )
    return [
        {"id": t.id, "name": t.name, "color": tc.color, "category_name": tc.name}
        for t, tc in rows.all()
    ]


@router.post("/customers/{customer_id}/tags", status_code=201)
async def add_consultant_tag(
    customer_id: str,
    body: TagAssignIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("consultant")),
):
    await _ensure_access(customer_id, current_user, db)
    await _ensure_consultant_tag(body.tag_id, db)
    exists = await db.execute(
        select(CustomerTag).where(
            CustomerTag.customer_id == customer_id,
            CustomerTag.tag_id == body.tag_id,
        )
    )
    if exists.scalar_one_or_none() is not None:
        raise HTTPException(400, "标签已存在")
    db.add(CustomerTag(customer_id=customer_id, tag_id=body.tag_id))
    await db.commit()
    return {"message": "ok"}


@router.delete("/customers/{customer_id}/tags/{tag_id}", status_code=204)
async def remove_consultant_tag(
    customer_id: str,
    tag_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("consultant")),
):
    await _ensure_access(customer_id, current_user, db)
    await _ensure_consultant_tag(tag_id, db)
    row = await db.execute(
        select(CustomerTag).where(
            CustomerTag.customer_id == customer_id,
            CustomerTag.tag_id == tag_id,
        )
    )
    rel = row.scalar_one_or_none()
    if rel is not None:
        await db.delete(rel)
        await db.commit()


@router.put("/customers/{customer_id}")
async def update_consultant_customer(
    customer_id: str,
    body: UpdateConsultantCustomerIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("consultant")),
):
    rel = await _ensure_access(customer_id, current_user, db)

    if body.note is not None:
        rel.note = body.note
    if body.start_date is not None:
        rel.start_date = date.fromisoformat(body.start_date)
    if body.end_date is not None:
        rel.end_date = date.fromisoformat(body.end_date)
    if body.next_consultation is not None:
        rel.next_consultation = datetime.fromisoformat(body.next_consultation)

    rel.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "ok"}


@router.post("/customers/{customer_id}/return-to-pool")
async def return_to_pool(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("consultant")),
):
    rel = await _ensure_access(customer_id, current_user, db)
    rel.status = "ended"
    rel.updated_at = datetime.utcnow()

    pending = await db.execute(
        select(ConsultantCustomer).where(
            ConsultantCustomer.customer_id == customer_id,
            ConsultantCustomer.status == "pending",
        )
    )
    if pending.scalar_one_or_none() is None:
        db.add(ConsultantCustomer(customer_id=customer_id, consultant_id=None, status="pending"))

    await db.commit()
    return {"message": "ok"}


@router.get("/pool", response_model=list[PoolItemOut])
async def consultant_pool(
    keyword: str | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("consultant")),
):
    customers_r = await db.execute(select(Customer).order_by(Customer.created_at.desc()))
    out: list[PoolItemOut] = []

    for c in customers_r.scalars().all():
        tags = await _build_tags(c.id, db)
        if keyword:
            k = keyword.strip().lower()
            if k and k not in c.name.lower() and not any(k in t.name.lower() for t in tags):
                continue

        products, _ = await _build_products(c.id, db)
        consultants = await _build_consultants(c.id, current_user.id, db)

        pending_r = await db.execute(
            select(ConsultantCustomer)
            .where(ConsultantCustomer.customer_id == c.id, ConsultantCustomer.status == "pending")
            .order_by(ConsultantCustomer.created_at.asc())
        )
        pending_rel = pending_r.scalars().first()

        pool_status = "pending" if len(consultants) == 0 else "serving"
        if status in {"pending", "serving", "ended"} and pool_status != status:
            continue

        if pending_rel:
            age_days = (datetime.utcnow().date() - pending_rel.created_at.date()).days
            age_label = f"{age_days}天前"
            sort_time = pending_rel.created_at.isoformat()
        elif consultants:
            any_rel_r = await db.execute(
                select(ConsultantCustomer)
                .where(
                    ConsultantCustomer.customer_id == c.id,
                    ConsultantCustomer.status == "active",
                )
                .order_by(ConsultantCustomer.created_at.asc())
            )
            first_rel = any_rel_r.scalars().first()
            sort_time = first_rel.created_at.isoformat() if first_rel else c.created_at.isoformat()
            age_label = f"{(first_rel.created_at if first_rel else c.created_at).strftime('%m/%d')}入池"
        else:
            sort_time = c.created_at.isoformat()
            age_label = "--"

        sales_name = None
        sales_r = await db.execute(select(User.name).where(User.id == c.entry_user_id))
        sales_name = sales_r.scalar_one_or_none()

        out.append(
            PoolItemOut(
                customer_id=c.id,
                customer_name=c.name,
                customer_info=_customer_info(c),
                tags=tags,
                products=products,
                sales_name=sales_name,
                consultants=consultants,
                pool_status=pool_status,
                pool_age_label=age_label,
                pool_sort_time=sort_time,
            )
        )

    out.sort(key=lambda i: (0 if i.pool_status == "pending" else 1, i.pool_sort_time), reverse=True)
    return out


@router.post("/pool/{customer_id}/claim")
async def claim_from_pool(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("consultant")),
):
    exists = await db.execute(
        select(ConsultantCustomer).where(
            ConsultantCustomer.customer_id == customer_id,
            ConsultantCustomer.consultant_id == current_user.id,
            ConsultantCustomer.status == "active",
        )
    )
    if exists.scalar_one_or_none() is not None:
        return {"message": "already_active"}

    ended = await db.execute(
        select(ConsultantCustomer).where(
            ConsultantCustomer.customer_id == customer_id,
            ConsultantCustomer.consultant_id == current_user.id,
            ConsultantCustomer.status == "ended",
        )
    )
    ended_rel = ended.scalar_one_or_none()
    if ended_rel:
        ended_rel.status = "active"
        ended_rel.updated_at = datetime.utcnow()
    else:
        db.add(ConsultantCustomer(customer_id=customer_id, consultant_id=current_user.id, status="active"))

    pendings = await db.execute(
        select(ConsultantCustomer).where(
            ConsultantCustomer.customer_id == customer_id,
            ConsultantCustomer.status == "pending",
        )
    )
    for p in pendings.scalars().all():
        await db.delete(p)

    await db.commit()
    return {"message": "ok"}


@router.get("/customers/{customer_id}/logs", response_model=list[LogItemOut])
async def list_logs(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("consultant")),
):
    rows = await db.execute(
        select(ConsultationLog, User)
        .join(User, User.id == ConsultationLog.consultant_id)
        .where(ConsultationLog.customer_id == customer_id)
        .order_by(ConsultationLog.log_date.desc(), ConsultationLog.created_at.desc())
    )
    return [
        LogItemOut(
            id=log.id,
            customer_id=log.customer_id,
            consultant_id=u.id,
            consultant_name=u.name,
            is_me=(log.consultant_id == current_user.id),
            log_date=log.log_date.isoformat(),
            duration=log.duration,
            summary=log.summary,
            content=log.content,
            created_at=log.created_at.isoformat(),
        )
        for log, u in rows.all()
    ]


@router.post("/customers/{customer_id}/logs", response_model=LogItemOut)
async def create_log(
    customer_id: str,
    body: UpsertLogIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("consultant")),
):
    await _ensure_access(customer_id, current_user, db)

    log = ConsultationLog(
        customer_id=customer_id,
        consultant_id=current_user.id,
        log_date=date.fromisoformat(body.log_date),
        duration=body.duration,
        content=body.content,
        summary=body.summary,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)

    return LogItemOut(
        id=log.id,
        customer_id=log.customer_id,
        consultant_id=current_user.id,
        consultant_name=current_user.name,
        is_me=True,
        log_date=log.log_date.isoformat(),
        duration=log.duration,
        summary=log.summary,
        content=log.content,
        created_at=log.created_at.isoformat(),
    )


@router.put("/logs/{log_id}", response_model=LogItemOut)
async def update_log(
    log_id: str,
    body: UpsertLogIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("consultant")),
):
    row = await db.execute(select(ConsultationLog).where(ConsultationLog.id == log_id))
    log = row.scalar_one_or_none()
    if log is None:
        raise HTTPException(404, "日志不存在")
    if log.consultant_id != current_user.id:
        raise HTTPException(403, "只能编辑自己的日志")

    log.log_date = date.fromisoformat(body.log_date)
    log.duration = body.duration
    log.content = body.content
    log.summary = body.summary
    log.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(log)

    return LogItemOut(
        id=log.id,
        customer_id=log.customer_id,
        consultant_id=current_user.id,
        consultant_name=current_user.name,
        is_me=True,
        log_date=log.log_date.isoformat(),
        duration=log.duration,
        summary=log.summary,
        content=log.content,
        created_at=log.created_at.isoformat(),
    )


@router.get("/dashboard", response_model=DashboardOut)
async def consultant_dashboard(
    month: str | None = Query(None, description="YYYY-MM"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("consultant")),
):
    today = date.today()
    if month:
        y, m = month.split("-")
        target = date(int(y), int(m), 1)
    else:
        target = date(today.year, today.month, 1)

    if target.month == 12:
        next_month = date(target.year + 1, 1, 1)
    else:
        next_month = date(target.year, target.month + 1, 1)

    if target.month == 1:
        prev_month = date(target.year - 1, 12, 1)
    else:
        prev_month = date(target.year, target.month - 1, 1)

    active_rows = await db.execute(
        select(ConsultantCustomer.customer_id)
        .where(
            ConsultantCustomer.consultant_id == current_user.id,
            ConsultantCustomer.status == "active",
        )
    )
    active_customer_ids = [r[0] for r in active_rows.all()]
    service_customers = len(set(active_customer_ids))

    co_service = 0
    for cid in set(active_customer_ids):
        others = await db.execute(
            select(func.count(ConsultantCustomer.id)).where(
                ConsultantCustomer.customer_id == cid,
                ConsultantCustomer.status == "active",
                ConsultantCustomer.consultant_id.is_not(None),
            )
        )
        if (others.scalar() or 0) > 1:
            co_service += 1

    meetings_this_month_r = await db.execute(
        select(func.count(ConsultationLog.id)).where(
            ConsultationLog.consultant_id == current_user.id,
            ConsultationLog.log_date >= target,
            ConsultationLog.log_date < next_month,
        )
    )
    meetings_this_month = meetings_this_month_r.scalar() or 0

    meetings_last_month_r = await db.execute(
        select(func.count(ConsultationLog.id)).where(
            ConsultationLog.consultant_id == current_user.id,
            ConsultationLog.log_date >= prev_month,
            ConsultationLog.log_date < target,
        )
    )
    meetings_last_month = meetings_last_month_r.scalar() or 0

    this_month_customers_r = await db.execute(
        select(func.count(func.distinct(ConsultationLog.customer_id))).where(
            ConsultationLog.consultant_id == current_user.id,
            ConsultationLog.log_date >= target,
            ConsultationLog.log_date < next_month,
        )
    )
    active_customers_with_meeting_this_month = this_month_customers_r.scalar() or 0
    active_customers_without_meeting_this_month = max(service_customers - active_customers_with_meeting_this_month, 0)

    total_meetings_r = await db.execute(
        select(func.count(ConsultationLog.id)).where(ConsultationLog.consultant_id == current_user.id)
    )
    total_meetings = total_meetings_r.scalar() or 0
    avg_meeting_per_service_customer = round(total_meetings / service_customers, 1) if service_customers else 0.0

    distribution: list[dict] = []
    if active_customer_ids:
        tag_rows = await db.execute(
            select(Tag.id, Tag.name, TagCategory.color, func.count(func.distinct(CustomerTag.customer_id)))
            .join(TagCategory, Tag.category_id == TagCategory.id)
            .join(CustomerTag, CustomerTag.tag_id == Tag.id)
            .where(CustomerTag.customer_id.in_(list(set(active_customer_ids))))
            .group_by(Tag.id, Tag.name, TagCategory.color)
            .order_by(func.count(func.distinct(CustomerTag.customer_id)).desc())
        )
        for tag_id, name, color, cnt in tag_rows.all():
            percent = round((cnt / service_customers) * 100, 1) if service_customers else 0
            distribution.append({
                "tag_id": tag_id,
                "name": name,
                "color": color,
                "count": cnt,
                "percent": percent,
            })

    return DashboardOut(
        service_customers=service_customers,
        co_service_customers=co_service,
        meetings_this_month=meetings_this_month,
        meetings_last_month=meetings_last_month,
        active_customers_with_meeting_this_month=active_customers_with_meeting_this_month,
        active_customers_without_meeting_this_month=active_customers_without_meeting_this_month,
        avg_meeting_per_service_customer=avg_meeting_per_service_customer,
        total_meetings=total_meetings,
        label_distribution=distribution,
    )
