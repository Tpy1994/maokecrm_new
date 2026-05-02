from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func, and_
from pydantic import BaseModel, Field

from app.core.deps import get_db, require_role
from app.models.user import User
from app.models.customer import Customer
from app.models.link_account import LinkAccount
from app.models.product import Product
from app.models.order import Order, CustomerProduct
from app.models.consultant_customer import ConsultantCustomer
from app.models.tag import Tag, CustomerTag, TagCategory

router = APIRouter(prefix="/sales", tags=["sales"])


# ===================== Schemas =====================

class LinkAccountOut(BaseModel):
    id: str
    account_id: str
    customer_count: int
    is_active: bool

class CustomerTagOut(BaseModel):
    id: str
    name: str
    color: str

class CustomerProductOut(BaseModel):
    product_id: str
    product_name: str
    price: int
    is_refunded: bool
    order_id: str | None = None

class CustomerOut(BaseModel):
    id: str
    name: str
    phone: str
    industry: str | None
    region: str | None
    link_account_id: str
    link_account_name: str | None
    tags: list[CustomerTagOut]
    products: list[CustomerProductOut]
    note: str | None
    next_follow_up: str | None
    follow_up_overdue: bool

class CustomerCreate(BaseModel):
    name: str = Field(max_length=50)
    phone: str = Field(max_length=20)
    industry: str | None = None
    region: str | None = None
    link_account_id: str

class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    industry: str | None = None
    region: str | None = None
    note: str | None = None
    next_follow_up: str | None = None

class PurchaseRequest(BaseModel):
    product_id: str
    amount: int = Field(ge=0)

class TagRequest(BaseModel):
    tag_id: str


# ===================== Helpers =====================

async def _get_my_customer(customer_id: str, current_user: User, db: AsyncSession) -> Customer:
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(404, "客户不存在")
    la_result = await db.execute(
        select(LinkAccount).where(
            LinkAccount.id == customer.link_account_id,
            LinkAccount.owner_id == current_user.id,
        )
    )
    if not la_result.scalar_one_or_none():
        raise HTTPException(403, "无权操作此客户")
    return customer


async def _get_owned_account_ids(current_user: User, db: AsyncSession) -> list[str]:
    result = await db.execute(
        select(LinkAccount.id).where(LinkAccount.owner_id == current_user.id)
    )
    return [row[0] for row in result.all()]


async def _build_customer_out(customer: Customer, db: AsyncSession) -> CustomerOut:
    # link_account name
    la_result = await db.execute(select(LinkAccount.account_id).where(LinkAccount.id == customer.link_account_id))
    la_name = la_result.scalar_one_or_none()

    # tags with category colors
    tag_rows = await db.execute(
        select(Tag, TagCategory)
        .join(TagCategory, Tag.category_id == TagCategory.id)
        .join(CustomerTag, and_(CustomerTag.tag_id == Tag.id, CustomerTag.customer_id == customer.id))
    )
    tags = [CustomerTagOut(id=t.id, name=t.name, color=tc.color) for t, tc in tag_rows.all()]

    # purchased products
    cp_rows = await db.execute(
        select(CustomerProduct, Product)
        .join(Product, CustomerProduct.product_id == Product.id)
        .where(CustomerProduct.customer_id == customer.id)
    )
    products = [
        CustomerProductOut(
            product_id=p.id, product_name=p.name, price=p.price,
            is_refunded=cp.is_refunded, order_id=cp.order_id,
        )
        for cp, p in cp_rows.all()
    ]

    # sales note / next_follow_up from consultant_customers (all "active" records for this customer)
    cc_result = await db.execute(
        select(ConsultantCustomer).where(
            ConsultantCustomer.customer_id == customer.id,
            ConsultantCustomer.status == "active",
        )
    )
    cc = cc_result.scalars().first()
    note = None
    next_fu = None
    overdue = False
    if cc:
        note = cc.note
        if cc.next_consultation:
            next_fu = cc.next_consultation.isoformat()
            overdue = cc.next_consultation.replace(tzinfo=None) < datetime.utcnow()

    return CustomerOut(
        id=customer.id, name=customer.name, phone=customer.phone,
        industry=customer.industry, region=customer.region,
        link_account_id=customer.link_account_id, link_account_name=la_name,
        tags=tags, products=products,
        note=note, next_follow_up=next_fu, follow_up_overdue=overdue,
    )


# ===================== Link Accounts =====================

@router.get("/link-accounts", response_model=list[LinkAccountOut])
async def list_link_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("sales")),
):
    result = await db.execute(
        select(LinkAccount).where(LinkAccount.owner_id == current_user.id)
    )
    accounts = result.scalars().all()

    cutoff = datetime.utcnow() - timedelta(days=30)
    out = []
    for a in accounts:
        cnt_result = await db.execute(
            select(func.count(Customer.id)).where(Customer.link_account_id == a.id)
        )
        cnt = cnt_result.scalar() or 0

        act_result = await db.execute(
            select(func.count(Customer.id)).where(
                Customer.link_account_id == a.id,
                Customer.last_active_at >= cutoff,
            )
        )
        is_active = (act_result.scalar() or 0) > 0

        out.append(LinkAccountOut(
            id=a.id, account_id=a.account_id,
            customer_count=cnt, is_active=is_active,
        ))
    return out


# ===================== Customers =====================

@router.get("/customers", response_model=list[CustomerOut])
async def list_customers(
    link_account_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("sales")),
):
    owned = await _get_owned_account_ids(current_user, db)
    if not owned:
        return []

    query = select(Customer).where(Customer.link_account_id.in_(owned))
    if link_account_id and link_account_id in owned:
        query = query.where(Customer.link_account_id == link_account_id)
    query = query.order_by(Customer.created_at.desc())

    result = await db.execute(query)
    out = []
    for c in result.scalars().all():
        out.append(await _build_customer_out(c, db))
    return out


@router.post("/customers", response_model=CustomerOut, status_code=201)
async def create_customer(
    body: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("sales")),
):
    la_result = await db.execute(
        select(LinkAccount).where(
            LinkAccount.id == body.link_account_id,
            LinkAccount.owner_id == current_user.id,
        )
    )
    if not la_result.scalar_one_or_none():
        raise HTTPException(400, "该账号不属于你")

    customer = Customer(
        name=body.name, phone=body.phone,
        industry=body.industry, region=body.region,
        link_account_id=body.link_account_id, entry_user_id=current_user.id,
    )
    db.add(customer)
    await db.flush()

    cc = ConsultantCustomer(
        consultant_id=current_user.id,
        customer_id=customer.id,
        status="active",
    )
    db.add(cc)
    await db.commit()
    await db.refresh(customer)
    return await _build_customer_out(customer, db)


@router.put("/customers/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: str,
    body: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("sales")),
):
    customer = await _get_my_customer(customer_id, current_user, db)

    if body.name is not None: customer.name = body.name
    if body.phone is not None: customer.phone = body.phone
    if body.industry is not None: customer.industry = body.industry
    if body.region is not None: customer.region = body.region

    if body.note is not None or body.next_follow_up is not None:
        cc_result = await db.execute(
            select(ConsultantCustomer).where(
                ConsultantCustomer.customer_id == customer_id,
                ConsultantCustomer.consultant_id == current_user.id,
                ConsultantCustomer.status == "active",
            )
        )
        cc = cc_result.scalar_one_or_none()
        if cc is None:
            cc = ConsultantCustomer(
                consultant_id=current_user.id,
                customer_id=customer_id,
                status="active",
            )
            db.add(cc)
            await db.flush()
        if body.note is not None:
            cc.note = body.note
        if body.next_follow_up is not None:
            cc.next_consultation = datetime.fromisoformat(body.next_follow_up)

    await db.commit()
    await db.refresh(customer)
    return await _build_customer_out(customer, db)


@router.post("/customers/{customer_id}/tags", status_code=201)
async def add_customer_tag(
    customer_id: str,
    body: TagRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("sales")),
):
    customer = await _get_my_customer(customer_id, current_user, db)
    exist = await db.execute(
        select(CustomerTag).where(
            CustomerTag.customer_id == customer_id,
            CustomerTag.tag_id == body.tag_id,
        )
    )
    if exist.scalar_one_or_none():
        raise HTTPException(400, "标签已存在")
    db.add(CustomerTag(customer_id=customer_id, tag_id=body.tag_id))
    customer.last_active_at = datetime.utcnow()
    await db.commit()
    return {"message": "ok"}


@router.delete("/customers/{customer_id}/tags/{tag_id}", status_code=204)
async def remove_customer_tag(
    customer_id: str, tag_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("sales")),
):
    customer = await _get_my_customer(customer_id, current_user, db)
    result = await db.execute(
        select(CustomerTag).where(
            CustomerTag.customer_id == customer_id,
            CustomerTag.tag_id == tag_id,
        )
    )
    ct = result.scalar_one_or_none()
    if ct:
        await db.delete(ct)
        await db.commit()


@router.post("/customers/{customer_id}/purchase")
async def purchase_product(
    customer_id: str,
    body: PurchaseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("sales")),
):
    customer = await _get_my_customer(customer_id, current_user, db)

    product_result = await db.execute(select(Product).where(Product.id == body.product_id))
    product = product_result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "产品不存在")

    order = Order(
        customer_id=customer_id, product_id=body.product_id,
        sales_user_id=current_user.id, amount=body.amount,
    )
    db.add(order)
    await db.flush()

    cp_result = await db.execute(
        select(CustomerProduct).where(
            CustomerProduct.customer_id == customer_id,
            CustomerProduct.product_id == body.product_id,
        )
    )
    cp = cp_result.scalar_one_or_none()
    if cp:
        cp.order_id = order.id
        cp.is_refunded = False
    else:
        db.add(CustomerProduct(
            customer_id=customer_id, product_id=body.product_id,
            order_id=order.id, is_refunded=False,
        ))

    if product.is_consultation:
        exist = await db.execute(
            select(ConsultantCustomer).where(
                ConsultantCustomer.customer_id == customer_id,
                ConsultantCustomer.status == "pending",
            )
        )
        if not exist.scalar_one_or_none():
            db.add(ConsultantCustomer(
                consultant_id=None, customer_id=customer_id, status="pending",
            ))

    customer.last_active_at = datetime.utcnow()
    await db.commit()
    return {"order_id": order.id, "message": "成交成功"}


@router.post("/orders/{order_id}/refund")
async def refund_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("sales")),
):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(404, "订单不存在")

    customer = await _get_my_customer(order.customer_id, current_user, db)

    if order.refunded_at:
        raise HTTPException(400, "已退款，不可重复操作")

    now = datetime.utcnow()
    order.refunded_at = now

    cp_result = await db.execute(
        select(CustomerProduct).where(
            CustomerProduct.customer_id == order.customer_id,
            CustomerProduct.product_id == order.product_id,
        )
    )
    cp = cp_result.scalar_one_or_none()
    if cp:
        cp.is_refunded = True

    await db.commit()

    # Time period impact
    om, oy = order.created_at.month, order.created_at.year
    rm, ry = now.month, now.year
    if ry == oy and rm == om:
        impact = "当月退款 — 扣减本月和双月数据"
    elif (ry == oy and (rm == om + 1 or rm == om - 1)) or \
         (ry == oy + 1 and om == 12 and rm == 1) or \
         (ry == oy - 1 and om == 1 and rm == 12):
        impact = "双月内非当月退款 — 仅扣减双月数据"
    else:
        impact = "双月外退款 — 不影响任何数据"

    return {"amount": order.amount, "refunded_at": now.isoformat(), "impact": impact}


# ===================== Products (sales view) =====================

@router.get("/products")
async def list_sales_products(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("sales")),
):
    """销售可看的产品列表（仅上架产品）"""
    result = await db.execute(
        select(Product).where(Product.status == "active").order_by(Product.name)
    )
    products = result.scalars().all()
    return [{"id": p.id, "name": p.name, "price": p.price, "is_consultation": p.is_consultation, "status": p.status} for p in products]


# ===================== Tags (sales view) =====================

@router.get("/tags")
async def list_sales_tags(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("sales")),
):
    """销售可用的全部标签（含分类颜色）"""
    from app.models.tag import TagCategory, Tag as TagModel

    result = await db.execute(
        select(TagModel, TagCategory).join(TagCategory, TagModel.category_id == TagCategory.id).order_by(TagCategory.sort_order, TagModel.name)
    )
    tags = []
    for t, tc in result.all():
        tags.append({
            "id": t.id,
            "name": t.name,
            "color": tc.color,
            "category_name": tc.name,
        })
    return tags


# ===================== Dashboard =====================

@router.get("/dashboard")
async def sales_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("sales")),
):
    """销售数据复盘：6 个核心数字 + 本月成交清单"""
    from calendar import monthrange
    from datetime import date as date_type

    now = datetime.utcnow()
    today = date_type.today()
    this_month_start = today.replace(day=1)
    last_month_start = (today.replace(day=1) - timedelta(days=1)).replace(day=1)
    yesterday = today - timedelta(days=1)
    _, last_day = monthrange(today.year, today.month)
    this_month_end = today.replace(day=last_day)
    dual_month_start = last_month_start

    owned = await _get_owned_account_ids(current_user, db)

    # 本月新增客户数
    new_this_month = 0
    if owned:
        r = await db.execute(
            select(func.count(Customer.id)).where(
                Customer.link_account_id.in_(owned),
                Customer.created_at >= this_month_start,
            )
        )
        new_this_month = r.scalar() or 0

    # 昨日新增
    new_yesterday = 0
    if owned:
        r = await db.execute(
            select(func.count(Customer.id)).where(
                Customer.link_account_id.in_(owned),
                Customer.created_at >= yesterday,
                Customer.created_at < today,
            )
        )
        new_yesterday = r.scalar() or 0

    # 本月成交数 / 金额 (排除当月退款的订单)
    orders_this_month = 0
    amount_this_month = 0
    if owned:
        r = await db.execute(
            select(Order).where(
                Order.sales_user_id == current_user.id,
                Order.created_at >= this_month_start,
                Order.created_at <= this_month_end,
            )
        )
        for o in r.scalars().all():
            if o.refunded_at is None:
                orders_this_month += 1
                amount_this_month += o.amount
            elif o.refunded_at.month != o.created_at.month or o.refunded_at.year != o.created_at.year:
                # 退款不在当月 → 当月数据保留
                orders_this_month += 1
                amount_this_month += o.amount

    # 双月转化率
    dual_customers = 0
    dual_orders_customers = 0
    if owned:
        r = await db.execute(
            select(func.count(Customer.id)).where(
                Customer.link_account_id.in_(owned),
                Customer.created_at >= dual_month_start,
            )
        )
        dual_customers = r.scalar() or 0
        r = await db.execute(
            select(func.count(func.distinct(Order.customer_id))).where(
                Order.sales_user_id == current_user.id,
                Order.created_at >= dual_month_start,
            )
        )
        dual_orders_customers = r.scalar() or 0

    conversion_rate = round((dual_orders_customers / dual_customers * 100), 1) if dual_customers > 0 else 0

    # 客户总数
    total_customers = 0
    if owned:
        r = await db.execute(
            select(func.count(Customer.id)).where(Customer.link_account_id.in_(owned))
        )
        total_customers = r.scalar() or 0

    # ── 本月成交清单 ──
    monthly_orders = []
    if owned:
        r = await db.execute(
            select(Order).where(
                Order.sales_user_id == current_user.id,
                Order.created_at >= this_month_start,
                Order.created_at <= this_month_end,
            ).order_by(Order.created_at.desc())
        )
        for o in r.scalars().all():
            # Customer info
            c_result = await db.execute(select(Customer).where(Customer.id == o.customer_id))
            cust = c_result.scalar_one_or_none()
            if not cust:
                continue

            # Product info
            p_result = await db.execute(select(Product).where(Product.id == o.product_id))
            prod = p_result.scalar_one_or_none()

            # LinkAccount name
            la_result = await db.execute(select(LinkAccount.account_id).where(LinkAccount.id == cust.link_account_id))
            la_name = la_result.scalar_one_or_none()

            # Tags
            tag_rows = await db.execute(
                select(Tag, TagCategory).join(TagCategory, Tag.category_id == TagCategory.id).join(
                    CustomerTag, and_(CustomerTag.tag_id == Tag.id, CustomerTag.customer_id == cust.id)
                )
            )
            tags = [{"name": t.name, "color": tc.color} for t, tc in tag_rows.all()]

            # Is this the first purchase of this product for this customer this month?
            is_first = True
            first_result = await db.execute(
                select(func.count(Order.id)).where(
                    Order.customer_id == o.customer_id,
                    Order.product_id == o.product_id,
                    Order.refunded_at == None,
                    Order.created_at < this_month_start,
                )
            )
            if (first_result.scalar() or 0) > 0:
                is_first = False

            # Check if refunded
            is_refunded = o.refunded_at is not None
            display_amount = o.amount
            if is_refunded and o.refunded_at.date() <= this_month_end and o.refunded_at.month == o.created_at.month:
                display_amount = 0  # 当月退款的当月订单不显示金额

            monthly_orders.append({
                "order_id": o.id,
                "order_date": o.created_at.isoformat()[:10],
                "customer_name": cust.name,
                "customer_info": (cust.industry or "") + ("·" + cust.region if cust.region else ""),
                "product_name": prod.name if prod else "已删除",
                "product_price": o.amount,
                "amount": display_amount if not is_refunded else o.amount,
                "is_refunded": is_refunded,
                "is_first_purchase": is_first,
                "link_account_name": la_name,
                "tags": tags,
            })

    return {
        "stats": {
            "new_this_month": new_this_month,
            "new_yesterday": new_yesterday,
            "orders_this_month": orders_this_month,
            "amount_this_month": amount_this_month,
            "conversion_rate": conversion_rate,
            "total_customers": total_customers,
        },
        "monthly_orders": monthly_orders,
    }
