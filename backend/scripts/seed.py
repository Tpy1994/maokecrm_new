import asyncio
from app.core.security import get_password_hash
from app.db import async_session, init_db
from app.models.user import User


async def seed():
    await init_db()
    from sqlmodel import select

    async with async_session() as db:
        result = await db.execute(select(User).where(User.phone == "13800000000"))
        if result.scalar_one_or_none() is None:
            admin = User(
                name="管理员",
                phone="13800000000",
                role="admin",
                status="active",
                hashed_password=get_password_hash("admin123"),
            )
            db.add(admin)
            await db.commit()
            print("Admin user created: 13800000000 / admin123")
        else:
            print("Admin user already exists")


if __name__ == "__main__":
    asyncio.run(seed())
