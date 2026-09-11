"""茶叶数据 API — 薄路由，业务在 service 层。"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import TeaResponse
from app.services import tea_service

router = APIRouter()


@router.get("/", response_model=list[TeaResponse])
async def list_teas(type: str | None = None, db: AsyncSession = Depends(get_db)):
    return await tea_service.list_teas(db, type)


@router.get("/{tea_id}", response_model=TeaResponse)
async def get_tea(tea_id: int, db: AsyncSession = Depends(get_db)):
    return await tea_service.get_tea_detail(db, tea_id)
