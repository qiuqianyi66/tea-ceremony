"""茶器数据 API"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import TeaWare
from app.schemas import TeaWareResponse

router = APIRouter()


@router.get("/", response_model=list[TeaWareResponse])
async def list_teawares(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TeaWare))
    return result.scalars().all()
