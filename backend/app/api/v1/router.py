from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.products import router as products_router
from app.api.v1.tags import router as tags_router
from app.api.v1.users import router as users_router
from app.api.v1.link_accounts import router as link_accounts_router
from app.api.v1.sales import router as sales_router
from app.api.v1.consultant import router as consultant_router
from app.api.v1.admin import router as admin_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(products_router)
router.include_router(tags_router)
router.include_router(users_router)
router.include_router(link_accounts_router)
router.include_router(sales_router)
router.include_router(consultant_router)
router.include_router(admin_router)
