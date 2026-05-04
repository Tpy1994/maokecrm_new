import asyncio
from datetime import date, datetime, timedelta

from sqlmodel import SQLModel

from app.core.security import get_password_hash
from app.db import async_session, engine
from app.models.consultant_customer import ConsultantCustomer
from app.models.consultation_log import ConsultationLog
from app.models.customer import Customer
from app.models.customer_course_enrollment import CustomerCourseEnrollment
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
        now = datetime.utcnow()

        # Users
        admin = User(name='管理员', phone='13800000000', role='admin', status='active', hashed_password=get_password_hash('admin123'))
        sales_a = User(name='张销售', phone='13800000001', role='sales', status='active', hashed_password=get_password_hash('demo123'))
        sales_b = User(name='李销售', phone='13800000002', role='sales', status='active', hashed_password=get_password_hash('demo123'))
        consultant_a = User(name='王咨询师', phone='13800000003', role='consultant', status='active', hashed_password=get_password_hash('demo123'))
        consultant_b = User(name='赵咨询师', phone='13800000004', role='consultant', status='active', hashed_password=get_password_hash('demo123'))
        db.add_all([admin, sales_a, sales_b, consultant_a, consultant_b])
        await db.flush()

        # Link accounts with transfer record
        la1 = LinkAccount(account_id='wxid_zhang_main', owner_id=sales_a.id)
        la2 = LinkAccount(account_id='wxid_zhang_new', owner_id=sales_a.id)
        la3 = LinkAccount(account_id='wxid_li_main', owner_id=sales_b.id)
        la3.last_transfer_at = now - timedelta(days=6)
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

        # Products (consultation and non-consultation)
        p1 = Product(name='短视频起号课', subtitle='入门课程', price=199900, is_consultation=False, status='active')
        p2 = Product(name='私董咨询年卡', subtitle='咨询类服务', price=999900, is_consultation=True, status='active')
        p3 = Product(name='直播转化实战营', subtitle='进阶课程', price=399900, is_consultation=False, status='active')
        p4 = Product(name='账号诊断咨询', subtitle='咨询类单次服务', price=299900, is_consultation=True, status='active')
        p5 = Product(name='历史下架课程', subtitle='用于状态测试', price=159900, is_consultation=False, status='inactive')
        db.add_all([p1, p2, p3, p4, p5])
        await db.flush()

        # Customers
        c1 = Customer(name='王小明', phone='13900000001', industry='服装', region='杭州', link_account_id=la1.id, entry_user_id=sales_a.id, sales_note='重点推进', next_follow_up=now + timedelta(hours=4), gifted_tuition_amount=500000, last_active_at=now - timedelta(hours=2))
        c2 = Customer(name='李华', phone='13900000002', industry='美妆', region='广州', link_account_id=la1.id, entry_user_id=sales_a.id, sales_note='咨询产品已成交', next_follow_up=now + timedelta(days=1, hours=1), gifted_tuition_amount=1200000, last_active_at=now - timedelta(days=1))
        c3 = Customer(name='陈晨', phone='13900000003', industry='食品', region='上海', link_account_id=la2.id, entry_user_id=sales_a.id, sales_note='待首购', next_follow_up=now - timedelta(hours=3), gifted_tuition_amount=0, last_active_at=now - timedelta(days=3))
        c4 = Customer(name='赵敏', phone='13900000004', industry='家居', region='成都', link_account_id=la3.id, entry_user_id=sales_b.id, sales_note='老客复购', next_follow_up=now + timedelta(days=2), gifted_tuition_amount=300000, last_active_at=now - timedelta(days=2))
        c5 = Customer(name='孙宇', phone='13900000005', industry='3C数码', region='深圳', link_account_id=la3.id, entry_user_id=sales_b.id, sales_note='历史退款样本', next_follow_up=now + timedelta(hours=8), gifted_tuition_amount=200000, last_active_at=now - timedelta(days=5))
        c6 = Customer(name='周宁', phone='13900000006', industry='教育', region='北京', link_account_id=la2.id, entry_user_id=sales_a.id, sales_note='待咨询师认领', next_follow_up=now + timedelta(days=3), gifted_tuition_amount=400000, last_active_at=now - timedelta(days=1, hours=4))
        db.add_all([c1, c2, c3, c4, c5, c6])
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
            CustomerTag(customer_id=c6.id, tag_id=tags_by_name['抖音'].id),
        ])

        # Orders (cover monthly deal count / refunds)
        orders = [
            Order(customer_id=c1.id, product_id=p1.id, sales_user_id=sales_a.id, amount=p1.price, created_at=now - timedelta(days=12)),
            Order(customer_id=c2.id, product_id=p2.id, sales_user_id=sales_a.id, amount=p2.price, created_at=now - timedelta(days=9)),
            Order(customer_id=c4.id, product_id=p3.id, sales_user_id=sales_b.id, amount=p3.price, created_at=now - timedelta(days=6)),
            Order(customer_id=c5.id, product_id=p1.id, sales_user_id=sales_b.id, amount=p1.price, created_at=now - timedelta(days=5), refunded_at=now - timedelta(days=1)),
            Order(customer_id=c6.id, product_id=p4.id, sales_user_id=sales_a.id, amount=p4.price, created_at=now - timedelta(days=2)),
            Order(customer_id=c1.id, product_id=p3.id, sales_user_id=sales_a.id, amount=p3.price, created_at=now - timedelta(days=1)),
        ]
        db.add_all(orders)
        await db.flush()

        # Customer products
        db.add_all([
            CustomerProduct(customer_id=c1.id, product_id=p1.id, order_id=orders[0].id, is_refunded=False),
            CustomerProduct(customer_id=c2.id, product_id=p2.id, order_id=orders[1].id, is_refunded=False),
            CustomerProduct(customer_id=c4.id, product_id=p3.id, order_id=orders[2].id, is_refunded=False),
            CustomerProduct(customer_id=c5.id, product_id=p1.id, order_id=orders[3].id, is_refunded=True),
            CustomerProduct(customer_id=c6.id, product_id=p4.id, order_id=orders[4].id, is_refunded=False),
            CustomerProduct(customer_id=c1.id, product_id=p3.id, order_id=orders[5].id, is_refunded=False),
        ])

        # Course enrollments (6 statuses full coverage)
        enrollments = [
            CustomerCourseEnrollment(customer_id=c1.id, order_id=orders[0].id, product_id=p1.id, amount_paid=p1.price, status='purchased_not_started', status_updated_by=sales_a.id, status_updated_role='sales', status_updated_at=now - timedelta(days=12)),
            CustomerCourseEnrollment(customer_id=c2.id, order_id=orders[1].id, product_id=p2.id, amount_paid=p2.price, status='sales_marked_completed', status_updated_by=sales_a.id, status_updated_role='sales', status_updated_at=now - timedelta(days=7)),
            CustomerCourseEnrollment(customer_id=c5.id, order_id=orders[3].id, product_id=p1.id, amount_paid=p1.price, status='purchased_not_started_refunded', status_updated_by=sales_b.id, status_updated_role='sales', status_updated_at=now - timedelta(days=1)),
            CustomerCourseEnrollment(customer_id=c4.id, order_id=orders[2].id, product_id=p3.id, amount_paid=p3.price, status='sales_marked_completed_refunded', status_updated_by=sales_b.id, status_updated_role='sales', status_updated_at=now - timedelta(days=2)),
            CustomerCourseEnrollment(customer_id=c6.id, order_id=orders[4].id, product_id=p4.id, amount_paid=p4.price, status='admin_marked_completed', status_updated_by=admin.id, status_updated_role='admin', status_updated_at=now - timedelta(days=1)),
            CustomerCourseEnrollment(customer_id=c1.id, order_id=orders[5].id, product_id=p3.id, amount_paid=p3.price, status='admin_marked_completed_refunded', status_updated_by=admin.id, status_updated_role='admin', status_updated_at=now - timedelta(hours=16)),
        ]
        db.add_all(enrollments)

        # Consultant relationships (no sales user here)
        relations = [
            ConsultantCustomer(consultant_id=consultant_a.id, customer_id=c2.id, status='active', start_date=date.today() - timedelta(days=20), end_date=date.today() + timedelta(days=40), next_consultation=now + timedelta(days=1), note='跟进中', consultation_count=3),
            ConsultantCustomer(consultant_id=consultant_b.id, customer_id=c4.id, status='active', start_date=date.today() - timedelta(days=10), end_date=date.today() + timedelta(days=30), next_consultation=now + timedelta(hours=5), note='重点客户', consultation_count=5),
            ConsultantCustomer(consultant_id=None, customer_id=c6.id, status='pending', consultation_count=0),
            ConsultantCustomer(consultant_id=None, customer_id=c3.id, status='pending', consultation_count=0),
            ConsultantCustomer(consultant_id=consultant_a.id, customer_id=c5.id, status='ended', start_date=date.today() - timedelta(days=60), end_date=date.today() - timedelta(days=8), consultation_count=8),
        ]
        db.add_all(relations)

        # Consultation logs
        db.add_all([
            ConsultationLog(customer_id=c2.id, consultant_id=consultant_a.id, log_date=date.today() - timedelta(days=6), duration=45, summary='首次诊断', content='梳理定位与目标'),
            ConsultationLog(customer_id=c2.id, consultant_id=consultant_a.id, log_date=date.today() - timedelta(days=2), duration=30, summary='执行复盘', content='复盘发布数据'),
            ConsultationLog(customer_id=c4.id, consultant_id=consultant_b.id, log_date=date.today() - timedelta(days=3), duration=60, summary='深度辅导', content='账号结构优化'),
            ConsultationLog(customer_id=c4.id, consultant_id=consultant_b.id, log_date=date.today() - timedelta(days=1), duration=35, summary='跟进会议', content='调整脚本策略'),
        ])

        await db.commit()

    print('Seed finished:')
    print('- users: 5 (admin 1, sales 2, consultant 2)')
    print('- link_accounts: 3 (with transfer record)')
    print('- customers: 6')
    print('- products: 5 (active 4, inactive 1)')
    print('- orders: 6 (1 refunded order)')
    print('- customer_course_enrollments: 6 (all 6 statuses covered)')
    print('- consultant_customers: 5 (active/pending/ended covered)')
    print('- consultation_logs: 4')


if __name__ == '__main__':
    asyncio.run(seed_all())
