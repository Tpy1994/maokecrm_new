import asyncio
from datetime import date, datetime, timedelta

from sqlmodel import SQLModel

from app.core.security import get_password_hash
from app.db import async_session, engine
from app.models.consultant_customer import ConsultantCustomer
from app.models.consultation_log import ConsultationLog
from app.models.customer import Customer
from app.models.link_account import LinkAccount
from app.models.order import CustomerProduct, Order
from app.models.product import Product
from app.models.tag import CustomerTag, Tag, TagCategory
from app.models.user import User


async def reset_schema() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
        await conn.run_sync(SQLModel.metadata.create_all)


async def seed_all() -> None:
    await reset_schema()

    async with async_session() as db:
        # Users
        admin = User(name='管理员', phone='13800000000', role='admin', status='active', hashed_password=get_password_hash('admin123'))
        sales_a = User(name='张销售', phone='13800000001', role='sales', status='active', hashed_password=get_password_hash('demo123'))
        sales_b = User(name='李销售', phone='13800000002', role='sales', status='active', hashed_password=get_password_hash('demo123'))
        consultant_a = User(name='王咨询师', phone='13800000003', role='consultant', status='active', hashed_password=get_password_hash('demo123'))
        consultant_b = User(name='赵咨询师', phone='13800000004', role='consultant', status='active', hashed_password=get_password_hash('demo123'))
        db.add_all([admin, sales_a, sales_b, consultant_a, consultant_b])
        await db.flush()

        # Link accounts
        la1 = LinkAccount(account_id='wxid_zhang001', owner_id=sales_a.id)
        la2 = LinkAccount(account_id='wxid_zhang002', owner_id=sales_a.id)
        la3 = LinkAccount(account_id='wxid_li001', owner_id=sales_b.id)
        la3.last_transfer_at = datetime.utcnow() - timedelta(days=2)
        la3.last_transfer_from_owner_name = '张销售'
        db.add_all([la1, la2, la3])
        await db.flush()

        # Tag categories and tags
        categories = [
            ('意向程度', 'sales', '#EA580C', 0, ['高意向', '中意向', '低意向']),
            ('来源渠道', 'sales', '#3B82F6', 1, ['抖音', '公众号', '转介绍', '社群']),
            ('客户关系', 'sales', '#8B5CF6', 2, ['新客', '老客', 'VIP']),
            ('咨询状态', 'consultant', '#22C55E', 0, ['进行中', '已完成', '即将到期']),
            ('学员等级', 'consultant', '#8B5CF6', 1, ['初级', '中级', '高级']),
        ]
        tags_by_name: dict[str, Tag] = {}
        for cname, group, color, sort_order, tags in categories:
            cat = TagCategory(name=cname, group=group, color=color, sort_order=sort_order)
            db.add(cat)
            await db.flush()
            for tname in tags:
                t = Tag(name=tname, category_id=cat.id)
                db.add(t)
                await db.flush()
                tags_by_name[tname] = t

        # Products
        p1 = Product(name='短视频起号课', subtitle='入门课程', price=199900, is_consultation=False, status='active')
        p2 = Product(name='私董咨询年卡', subtitle='咨询类服务', price=999900, is_consultation=True, status='active')
        p3 = Product(name='直播转化实战营', subtitle='进阶课程', price=399900, is_consultation=False, status='active')
        db.add_all([p1, p2, p3])
        await db.flush()

        # Customers
        now = datetime.utcnow()
        c1 = Customer(name='王小明', phone='13900000001', industry='服装', region='杭州', link_account_id=la1.id, entry_user_id=sales_a.id, last_active_at=now - timedelta(days=1))
        c2 = Customer(name='李华', phone='13900000002', industry='美妆', region='广州', link_account_id=la1.id, entry_user_id=sales_a.id, last_active_at=now - timedelta(days=3))
        c3 = Customer(name='陈晨', phone='13900000003', industry='食品', region='上海', link_account_id=la2.id, entry_user_id=sales_a.id, last_active_at=now - timedelta(days=5))
        c4 = Customer(name='赵敏', phone='13900000004', industry='家居', region='成都', link_account_id=la3.id, entry_user_id=sales_b.id, last_active_at=now - timedelta(days=2))
        c5 = Customer(name='孙宇', phone='13900000005', industry='3C数码', region='深圳', link_account_id=la3.id, entry_user_id=sales_b.id, last_active_at=now - timedelta(days=7))
        db.add_all([c1, c2, c3, c4, c5])
        await db.flush()

        # Customer tags
        db.add_all([
            CustomerTag(customer_id=c1.id, tag_id=tags_by_name['高意向'].id),
            CustomerTag(customer_id=c1.id, tag_id=tags_by_name['新客'].id),
            CustomerTag(customer_id=c2.id, tag_id=tags_by_name['中意向'].id),
            CustomerTag(customer_id=c2.id, tag_id=tags_by_name['转介绍'].id),
            CustomerTag(customer_id=c3.id, tag_id=tags_by_name['低意向'].id),
            CustomerTag(customer_id=c4.id, tag_id=tags_by_name['VIP'].id),
            CustomerTag(customer_id=c4.id, tag_id=tags_by_name['进行中'].id),
            CustomerTag(customer_id=c5.id, tag_id=tags_by_name['公众号'].id),
            CustomerTag(customer_id=c5.id, tag_id=tags_by_name['中级'].id),
        ])

        # Orders + customer products
        o1 = Order(customer_id=c1.id, product_id=p1.id, sales_user_id=sales_a.id, amount=p1.price, created_at=now - timedelta(days=10))
        o2 = Order(customer_id=c2.id, product_id=p2.id, sales_user_id=sales_a.id, amount=p2.price, created_at=now - timedelta(days=8))
        o3 = Order(customer_id=c4.id, product_id=p3.id, sales_user_id=sales_b.id, amount=p3.price, created_at=now - timedelta(days=3))
        o4 = Order(customer_id=c5.id, product_id=p1.id, sales_user_id=sales_b.id, amount=p1.price, created_at=now - timedelta(days=2), refunded_at=now - timedelta(days=1))
        db.add_all([o1, o2, o3, o4])
        await db.flush()

        cp1 = CustomerProduct(customer_id=c1.id, product_id=p1.id, order_id=o1.id, is_refunded=False)
        cp2 = CustomerProduct(customer_id=c2.id, product_id=p2.id, order_id=o2.id, is_refunded=False)
        cp3 = CustomerProduct(customer_id=c4.id, product_id=p3.id, order_id=o3.id, is_refunded=False)
        cp4 = CustomerProduct(customer_id=c5.id, product_id=p1.id, order_id=o4.id, is_refunded=True)
        db.add_all([cp1, cp2, cp3, cp4])
        await db.flush()

        # Consultant relationships
        rel1 = ConsultantCustomer(consultant_id=consultant_a.id, customer_id=c2.id, status='active', start_date=date.today() - timedelta(days=20), end_date=date.today() + timedelta(days=40), next_consultation=now + timedelta(days=1), note='跟进中', consultation_count=3)
        rel2 = ConsultantCustomer(consultant_id=consultant_b.id, customer_id=c4.id, status='active', start_date=date.today() - timedelta(days=15), end_date=date.today() + timedelta(days=20), next_consultation=now + timedelta(hours=5), note='重点客户', consultation_count=5)
        rel3 = ConsultantCustomer(consultant_id=None, customer_id=c3.id, status='pending', consultation_count=0)
        rel4 = ConsultantCustomer(consultant_id=consultant_a.id, customer_id=c5.id, status='ended', start_date=date.today() - timedelta(days=60), end_date=date.today() - timedelta(days=5), consultation_count=8)
        rel5 = ConsultantCustomer(consultant_id=sales_a.id, customer_id=c1.id, status='active', consultation_count=0)
        db.add_all([rel1, rel2, rel3, rel4, rel5])
        await db.flush()

        # Consultation logs
        logs = [
            ConsultationLog(customer_id=c2.id, consultant_id=consultant_a.id, log_date=date.today() - timedelta(days=6), duration=45, summary='首次诊断', content='梳理定位与目标'),
            ConsultationLog(customer_id=c2.id, consultant_id=consultant_a.id, log_date=date.today() - timedelta(days=2), duration=30, summary='执行复盘', content='复盘发布数据'),
            ConsultationLog(customer_id=c4.id, consultant_id=consultant_b.id, log_date=date.today() - timedelta(days=3), duration=60, summary='深度辅导', content='账号结构优化'),
            ConsultationLog(customer_id=c4.id, consultant_id=consultant_b.id, log_date=date.today() - timedelta(days=1), duration=35, summary='跟进会议', content='调整脚本策略'),
        ]
        db.add_all(logs)

        await db.commit()

    print('Seed finished:')
    print('- users: 5 (admin 1, sales 2, consultant 2)')
    print('- link_accounts: 3 (with 1 transfer record)')
    print('- customers: 5')
    print('- products: 3')
    print('- orders: 4 (1 refunded)')
    print('- consultant_customers: 5 (active/pending/ended covered)')
    print('- consultation_logs: 4')


if __name__ == '__main__':
    asyncio.run(seed_all())
