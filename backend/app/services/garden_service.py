"""茶园域 service：client_id 幂等 upsert。"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GardenPlant
from app.schemas import GardenPlantCreate


async def upsert_plant(
    db: AsyncSession,
    user_id: int,
    data: GardenPlantCreate,
) -> GardenPlant:
    """按 user_id + client_id 幂等 upsert：已存在则更新状态，否则新建。"""
    result = await db.execute(
        select(GardenPlant).filter(
            GardenPlant.user_id == user_id,
            GardenPlant.client_id == data.client_id,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        for field, value in data.model_dump().items():
            setattr(existing, field, value)
        await db.commit()
        await db.refresh(existing)
        return existing
    plant = GardenPlant(**data.model_dump(), user_id=user_id)
    db.add(plant)
    await db.commit()
    await db.refresh(plant)
    return plant


async def list_plants(db: AsyncSession, user_id: int):
    stmt = (
        select(GardenPlant)
        .filter(GardenPlant.user_id == user_id)
        .order_by(GardenPlant.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()
