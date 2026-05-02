import asyncio
from app.db import async_session, engine
from sqlmodel import SQLModel
from app.models.user import User
from app.models.link_account import LinkAccount
from app.models.customer import Customer
from app.models.consultant_customer import ConsultantCustomer
from app.models.tag import TagCategory, Tag
from app.core.security import get_password_hash


SEED_CATEGORIES = [
    {"name": "意向程度", "group": "sales", "color": "#EA580C", "sort": 0, "tags": ["高意向", "中意向", "低意向"]},
    {"name": "行业类目", "group": "sales", "color": "#3B82F6", "sort": 1, "tags": ["服装", "美妆", "食品", "家居", "3C数码", "母婴"]},
    {"name": "来源渠道", "group": "sales", "color": "#3B82F6", "sort": 2, "tags": ["抖音", "公众号", "转介绍", "主动添加", "社群"]},
    {"name": "客户关系", "group": "sales", "color": "#8B5CF6", "sort": 3, "tags": ["新客", "老客", "VIP"]},
    {"name": "咨询状态", "group": "consultant", "color": "#22C55E", "sort": 0, "tags": ["进行中", "已完成", "待续费", "即将到期"]},
    {"name": "学员等级", "group": "consultant", "color": "#8B5CF6", "sort": 1, "tags": ["初级", "中级", "高级"]},
    {"name": "服务类型", "group": "consultant", "color": "#6B7280", "sort": 2, "tags": ["日常咨询", "专题辅导", "紧急处理"]},
]


async def reset_and_seed():
    # Drop and recreate
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.drop_all)
        await conn.run_sync(SQLModel.metadata.create_all)
    print("Tables recreated")

    async with async_session() as db:
        # Admin
        admin = User(name="管理员", phone="13800000000", role="admin", status="active",
                     hashed_password=get_password_hash("admin123"))
        db.add(admin)
        await db.flush()

        # Demo sales with link accounts
        s1 = User(name="张销售", phone="13800000001", role="sales", status="active",
                  hashed_password=get_password_hash("demo123"))
        db.add(s1)
        await db.flush()
        la1 = LinkAccount(account_id="wxid_zhang001", owner_id=s1.id)
        db.add(la1)
        la2 = LinkAccount(account_id="wxid_zhang002", owner_id=s1.id)
        db.add(la2)

        s2 = User(name="李销售主管", phone="13800000002", role="sales", status="active",
                  hashed_password=get_password_hash("demo123"))
        db.add(s2)
        await db.flush()

        # Consultant
        User(name="王咨询师", phone="13800000003", role="consultant", status="active",
             hashed_password=get_password_hash("demo123"))
        db.add(c1 := await _flush_and_refresh(db, User(
            name="王咨询师", phone="13800000003", role="consultant", status="active",
            hashed_password=get_password_hash("demo123"))))

        User(name="赵咨询师", phone="13800000004", role="consultant", status="active",
             hashed_password=get_password_hash("demo123"))
        db.add(await _flush_and_refresh(db, User(
            name="赵咨询师", phone="13800000004", role="consultant", status="active",
            hashed_password=get_password_hash("demo123"))))

        # Tag categories
        for c in SEED_CATEGORIES:
            cat = TagCategory(name=c["name"], group=c["group"], color=c["color"], sort_order=c["sort"])
            db.add(cat)
            await db.flush()
            for t in c["tags"]:
                db.add(Tag(name=t, category_id=cat.id))

        await db.commit()
        print(f"Seed complete: 1 admin + 2 sales + 2 consultants + {len(SEED_CATEGORIES)} tag categories")


if __name__ == "__main__":
    asyncio.run(reset_and_seed())
