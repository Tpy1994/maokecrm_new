import asyncio
from datetime import datetime, timedelta

from sqlmodel import select

from app.db import async_session, init_db
from app.models.consultant_customer import ConsultantCustomer
from app.models.customer import Customer
from app.models.link_account import LinkAccount
from app.models.order import CustomerProduct, Order
from app.models.product import Product
from app.models.user import User


async def _get_or_create_user(phone: str, name: str, role: str, password_hash: str) -> User:
    from app.core.security import get_password_hash

    async with async_session() as db:
        row = await db.execute(select(User).where(User.phone == phone))
        user = row.scalar_one_or_none()
        if user:
            return user
        user = User(
            phone=phone,
            name=name,
            role=role,
            status="active",
            hashed_password=password_hash or get_password_hash("demo123"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user


async def seed_consultant_pool_test_data():
    await init_db()

    from app.core.security import get_password_hash

    sales = await _get_or_create_user("13800000001", "销售A", "sales", get_password_hash("demo123"))
    consultant_me = await _get_or_create_user("13800000003", "咨询师A", "consultant", get_password_hash("demo123"))
    consultant_other = await _get_or_create_user("13800000004", "咨询师B", "consultant", get_password_hash("demo123"))

    async with async_session() as db:
        la_ids: list[str] = []
        for idx in range(1, 7):
            account_id = f"pool_test_wx_{idx:02d}"
            row = await db.execute(select(LinkAccount).where(LinkAccount.account_id == account_id))
            la = row.scalar_one_or_none()
            if la is None:
                la = LinkAccount(account_id=account_id, owner_id=sales.id)
                db.add(la)
                await db.flush()
            la_ids.append(la.id)

        product_row = await db.execute(select(Product).where(Product.name == "咨询测试产品"))
        product = product_row.scalar_one_or_none()
        if product is None:
            product = Product(name="咨询测试产品", subtitle="用于咨询池认领测试", price=199900, is_consultation=True, status="active")
            db.add(product)
            await db.flush()

        now = datetime.utcnow()
        customer_specs = [
            ("测试客户-待认领-01", "13910000001", la_ids[0], "pending", None, now - timedelta(days=2)),
            ("测试客户-待认领-02", "13910000002", la_ids[1], "pending", None, now - timedelta(days=1, hours=2)),
            ("测试客户-他人认领-01", "13910000003", la_ids[2], "active", consultant_other.id, now - timedelta(days=3)),
            ("测试客户-他人认领-02", "13910000004", la_ids[3], "active", consultant_other.id, now - timedelta(hours=20)),
            ("测试客户-我已加入-01", "13910000005", la_ids[4], "active", consultant_me.id, now - timedelta(days=4)),
            ("测试客户-多人服务-01", "13910000006", la_ids[5], "active", consultant_other.id, now - timedelta(days=5)),
        ]

        created = 0
        for name, phone, link_account_id, status, consultant_id, created_at in customer_specs:
            row = await db.execute(select(Customer).where(Customer.phone == phone))
            customer = row.scalar_one_or_none()
            if customer is None:
                customer = Customer(
                    name=name,
                    phone=phone,
                    industry="测试渠道",
                    region="华东",
                    link_account_id=link_account_id,
                    entry_user_id=sales.id,
                )
                db.add(customer)
                await db.flush()
                created += 1

            pool_row = await db.execute(
                select(ConsultantCustomer).where(
                    ConsultantCustomer.customer_id == customer.id,
                    ConsultantCustomer.status == status,
                    ConsultantCustomer.consultant_id == consultant_id,
                )
            )
            relation = pool_row.scalar_one_or_none()
            if relation is None:
                relation = ConsultantCustomer(
                    customer_id=customer.id,
                    consultant_id=consultant_id,
                    status=status,
                    created_at=created_at,
                    updated_at=created_at,
                )
                db.add(relation)

            cp_row = await db.execute(select(CustomerProduct).where(CustomerProduct.customer_id == customer.id))
            if cp_row.scalar_one_or_none() is None:
                order = Order(
                    customer_id=customer.id,
                    product_id=product.id,
                    sales_user_id=sales.id,
                    amount=product.price,
                )
                db.add(order)
                await db.flush()
                db.add(
                    CustomerProduct(
                        customer_id=customer.id,
                        product_id=product.id,
                        order_id=order.id,
                        is_refunded=False,
                    )
                )

        # 多人服务案例：补一条“我也在服务”的关系
        multi_customer_row = await db.execute(select(Customer).where(Customer.phone == "13910000006"))
        multi_customer = multi_customer_row.scalar_one_or_none()
        if multi_customer is not None:
            join_row = await db.execute(
                select(ConsultantCustomer).where(
                    ConsultantCustomer.customer_id == multi_customer.id,
                    ConsultantCustomer.consultant_id == consultant_me.id,
                    ConsultantCustomer.status == "active",
                )
            )
            if join_row.scalar_one_or_none() is None:
                db.add(
                    ConsultantCustomer(
                        customer_id=multi_customer.id,
                        consultant_id=consultant_me.id,
                        status="active",
                        created_at=now - timedelta(days=4, hours=10),
                        updated_at=now - timedelta(days=4, hours=10),
                    )
                )

        await db.commit()
        print(f"Consultant pool test data ready. New customers created: {created}")


if __name__ == "__main__":
    asyncio.run(seed_consultant_pool_test_data())
