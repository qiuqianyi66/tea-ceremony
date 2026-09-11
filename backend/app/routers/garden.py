"""茶园种植 API — 薄路由，幂等 upsert 在 service。"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import GardenPlantCreate, GardenPlantResponse
from app.services import garden_service

router = APIRouter()


@router.post("/", response_model=GardenPlantResponse)
async def upsert_plant(
    data: GardenPlantCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await garden_service.upsert_plant(db, user.id, data)


@router.get("/", response_model=list[GardenPlantResponse])
async def list_plants(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await garden_service.list_plants(db, user.id)
