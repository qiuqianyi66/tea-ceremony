"""茶叶数据 API"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Tea
from app.schemas import TeaResponse

router = APIRouter()


@router.get("/", response_model=list[TeaResponse])
async def list_teas(type: str | None = None, db: AsyncSession = Depends(get_db)):
    stmt = select(Tea)
    if type:
        stmt = stmt.filter(Tea.category == type)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{tea_id}", response_model=TeaResponse)
async def get_tea(tea_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tea).filter(Tea.id == tea_id))
    tea = result.scalar_one_or_none()
    if not tea:
        raise HTTPException(status_code=404, detail="茶叶不存在")
    return tea
