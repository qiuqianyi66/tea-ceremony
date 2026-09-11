"""茶园种植 API：离线优先，client_id 幂等同步"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User, GardenPlant
from app.schemas import GardenPlantCreate, GardenPlantResponse

router = APIRouter()


@router.post("/", response_model=GardenPlantResponse)
async def upsert_plant(
    data: GardenPlantCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """按 user_id + client_id 幂等 upsert：已存在则更新状态，否则新建。"""
    result = await db.execute(
        select(GardenPlant).filter(
            GardenPlant.user_id == user.id,
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
    plant = GardenPlant(**data.model_dump(), user_id=user.id)
    db.add(plant)
    await db.commit()
    await db.refresh(plant)
    return plant


@router.get("/", response_model=list[GardenPlantResponse])
async def list_plants(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = (
        select(GardenPlant)
        .filter(GardenPlant.user_id == user.id)
        .order_by(GardenPlant.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()
