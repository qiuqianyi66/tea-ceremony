"""通用 CRUD service — 业务 service 复用，router 不再手写 select(Model).filter(...)。"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError


async def get_by_id(
    db: AsyncSession,
    model,
    obj_id: int,
    *,
    options: list | None = None,
    not_found_msg: str = "记录不存在",
):
    """按主键查询，不存在抛 NotFoundError。options 用于 selectinload 等加载策略。"""
    stmt = select(model).where(model.id == obj_id)
    if options:
        for opt in options:
            stmt = stmt.options(opt)
    result = await db.execute(stmt)
    obj = result.scalar_one_or_none()
    if not obj:
        raise NotFoundError(not_found_msg)
    return obj


async def list_by(
    db: AsyncSession,
    model,
    *,
    order_by=None,
    offset: int = 0,
    limit: int = 100,
    options: list | None = None,
    **filters,
):
    """按字段过滤查询列表；filters 为 filter_by 语义的等值条件。"""
    stmt = select(model)
    if filters:
        stmt = stmt.filter_by(**filters)
    if options:
        for opt in options:
            stmt = stmt.options(opt)
    if order_by is not None:
        stmt = stmt.order_by(order_by)
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


async def create(db: AsyncSession, model, **fields):
    obj = model(**fields)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def update(db: AsyncSession, obj, **fields):
    for field, value in fields.items():
        setattr(obj, field, value)
    await db.commit()
    await db.refresh(obj)
    return obj


async def delete(db: AsyncSession, obj) -> None:
    await db.delete(obj)
    await db.commit()
