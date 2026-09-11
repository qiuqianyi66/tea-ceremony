"""茶叶域 service。"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Tea
from app.services.base_service import get_by_id, list_by


async def list_teas(db: AsyncSession, tea_type: str | None = None):
    """茶叶列表；tea_type 为空返回全部。"""
    filters = {"category": tea_type} if tea_type else {}
    return await list_by(db, Tea, order_by=Tea.id, **filters)


async def get_tea_detail(db: AsyncSession, tea_id: int) -> Tea:
    """茶叶详情，selectinload 产区/工艺避免 N+1。"""
    return await get_by_id(
        db,
        Tea,
        tea_id,
        options=[selectinload(Tea.region), selectinload(Tea.process)],
        not_found_msg="茶叶不存在",
    )
