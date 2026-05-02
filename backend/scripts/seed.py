import asyncio
from datetime import date

from sqlmodel import select

from app.core.security import get_password_hash
from app.db import async_session, init_db
from app.models.user import User
from app.models.tag import TagCategory, Tag


SEED_CATEGORIES = [
    # 销售标签
    {"name": "意向程度", "group": "sales", "color": "#EA580C", "sort": 0, "tags": ["高意向", "中意向", "低意向"]},
    {"name": "行业类目", "group": "sales", "color": "#3B82F6", "sort": 1, "tags": ["服装", "美妆", "食品", "家居", "3C数码", "母婴"]},
    {"name": "来源渠道", "group": "sales", "color": "#3B82F6", "sort": 2, "tags": ["抖音", "公众号", "转介绍", "主动添加", "社群"]},
    {"name": "客户关系", "group": "sales", "color": "#8B5CF6", "sort": 3, "tags": ["新客", "老客", "VIP"]},
    # 咨询师标签
    {"name": "咨询状态", "group": "consultant", "color": "#22C55E", "sort": 0, "tags": ["进行中", "已完成", "待续费", "即将到期"]},
    {"name": "学员等级", "group": "consultant", "color": "#8B5CF6", "sort": 1, "tags": ["初级", "中级", "高级"]},
    {"name": "服务类型", "group": "consultant", "color": "#6B7280", "sort": 2, "tags": ["日常咨询", "专题辅导", "紧急处理"]},
]


async def seed():
    await init_db()

    async with async_session() as db:
        # Admin user
        result = await db.execute(select(User).where(User.phone == "13800000000"))
        if result.scalar_one_or_none() is None:
            db.add(User(name="管理员", phone="13800000000", role="admin", status="active",
                        hashed_password=get_password_hash("admin123")))
            print("Admin user created: 13800000000 / admin123")
        else:
            print("Admin user already exists")

        # Demo users
        demo_users = [
            {"name": "张销售", "phone": "13800000001", "role": "sales", "status": "active", "hired_at": date(2023, 3, 15)},
            {"name": "李销售主管", "phone": "13800000002", "role": "sales", "status": "active", "hired_at": date(2022, 8, 1)},
            {"name": "王咨询师", "phone": "13800000003", "role": "consultant", "status": "active", "hired_at": date(2023, 6, 10)},
            {"name": "赵咨询师", "phone": "13800000004", "role": "consultant", "status": "active", "hired_at": date(2024, 1, 20)},
            {"name": "孙销售", "phone": "13800000005", "role": "sales", "status": "inactive", "hired_at": date(2023, 1, 5)},
        ]
        for u in demo_users:
            exist = await db.execute(select(User).where(User.phone == u["phone"]))
            if not exist.scalar_one_or_none():
                db.add(User(name=u["name"], phone=u["phone"], role=u["role"], status=u["status"],
                            hired_at=u.get("hired_at"), hashed_password=get_password_hash("demo123")))
                print(f"User created: {u['name']} ({u['role']}) {u['phone']}")

        await db.commit()

        # Tag categories + tags
        cats = await db.execute(select(TagCategory))
        if cats.scalars().first() is None:
            for c in SEED_CATEGORIES:
                cat = TagCategory(name=c["name"], group=c["group"], color=c["color"], sort_order=c["sort"])
                db.add(cat)
                await db.flush()
                for t in c["tags"]:
                    db.add(Tag(name=t, category_id=cat.id))
            print(f"Tag seed data created: {len(SEED_CATEGORIES)} categories")
        else:
            print("Tag categories already exist")

        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed())
