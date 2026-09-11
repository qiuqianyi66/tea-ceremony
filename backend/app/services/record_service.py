"""品鉴记录域 service：client_id 幂等、分页、删除。"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError
from app.models import TastingRecord
from app.schemas import RecordCreate


async def create_record(
    db: AsyncSession,
    user_id: int,
    data: RecordCreate,
) -> TastingRecord:
    """创建品鉴记录；client_id 幂等：同用户同客户端 ID 直接返回已有记录。"""
    if data.client_id:
        result = await db.execute(
            select(TastingRecord).filter(
                TastingRecord.user_id == user_id,
                TastingRecord.client_id == data.client_id,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing
    record = TastingRecord(**data.model_dump(), user_id=user_id)
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def list_records(
    db: AsyncSession,
    user_id: int,
    skip: int = 0,
    limit: int = 50,
):
    limit = min(max(limit, 1), 100)
    stmt = (
        select(TastingRecord)
        .filter(TastingRecord.user_id == user_id)
        .order_by(TastingRecord.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_record(db: AsyncSession, user_id: int, record_id: int) -> TastingRecord:
    result = await db.execute(
        select(TastingRecord).filter(
            TastingRecord.id == record_id,
            TastingRecord.user_id == user_id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise NotFoundError("记录不存在")
    return record


async def delete_record(db: AsyncSession, user_id: int, record_id: int) -> None:
    record = await get_record(db, user_id, record_id)
    await db.delete(record)
    await db.commit()
