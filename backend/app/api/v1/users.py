from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select, func

from app.core.deps import get_db, require_role
from app.core.security import get_password_hash
from app.models.user import User
from app.models.link_account import LinkAccount
from app.models.customer import Customer
from app.schemas.user import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=list[UserOut])
async def list_users(
    role: str | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("admin")),
):
    query = select(User)
    if role:
        query = query.where(User.role == role)
    if status:
        query = query.where(User.status == status)
    query = query.order_by(User.role, User.name)
    result = await db.execute(query)
    users = result.scalars().all()

    out = []
    for u in users:
        wa_result = await db.execute(select(func.count()).select_from(LinkAccount).where(LinkAccount.owner_id == u.id))
        wa_count = wa_result.scalar() or 0
        c_result = await db.execute(select(func.count()).select_from(Customer).where(Customer.entry_user_id == u.id))
        c_count = c_result.scalar() or 0
        out.append(UserOut(
            id=u.id, name=u.name, phone=u.phone, role=u.role, status=u.status,
            hired_at=u.hired_at.isoformat() if u.hired_at else None,
            wechat_count=wa_count, customer_count=c_count,
        ))
    return out


@router.get("/{user_id}", response_model=UserOut)
async def get_user(user_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/", response_model=UserOut, status_code=201)
async def create_user(body: UserCreate, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    existing = await db.execute(select(User).where(User.phone == body.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该手机号已被使用")
    import datetime as _dt
    user = User(
        name=body.name,
        phone=body.phone,
        role=body.role,
        hashed_password=get_password_hash(body.password),
        hired_at=_dt.date.fromisoformat(body.hired_at) if body.hired_at else None,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserOut(
        id=user.id, name=user.name, phone=user.phone,
        role=user.role, status=user.status,
        hired_at=user.hired_at.isoformat() if user.hired_at else None,
    )


@router.put("/{user_id}", response_model=UserOut)
async def update_user(user_id: str, body: UserUpdate, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = body.model_dump(exclude_none=True)
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    import datetime as _dt
    if "hired_at" in update_data and isinstance(update_data["hired_at"], str):
        update_data["hired_at"] = _dt.date.fromisoformat(update_data["hired_at"])
    for key, value in update_data.items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return UserOut(
        id=user.id, name=user.name, phone=user.phone,
        role=user.role, status=user.status,
        hired_at=user.hired_at.isoformat() if user.hired_at else None,
    )


@router.delete("/{user_id}", status_code=204)
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db), _=Depends(require_role("admin"))):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "inactive"
    await db.commit()
