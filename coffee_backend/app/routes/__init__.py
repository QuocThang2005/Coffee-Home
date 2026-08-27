from fastapi import APIRouter

from ._common import _active_ws, _ws_lock, _set_main_loop

from .auth import router as auth_router
from .chat import router as chat_router
from .orders import router as orders_router
from .bookings import router as bookings_router
from .feedbacks import router as feedbacks_router
from .applications import router as applications_router
from .products import router as products_router
from .vouchers import router as vouchers_router
from .reviews import router as reviews_router
from .admin import router as admin_router
from .loyalty import router as loyalty_router

router = APIRouter(prefix="/api")
router.include_router(auth_router)
router.include_router(chat_router)
router.include_router(orders_router)
router.include_router(bookings_router)
router.include_router(feedbacks_router)
router.include_router(applications_router)
router.include_router(products_router)
router.include_router(vouchers_router)
router.include_router(reviews_router)
router.include_router(admin_router)
router.include_router(loyalty_router)
