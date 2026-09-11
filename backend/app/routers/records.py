"""品鉴记录 API — 薄路由，幂等/查询/删除逻辑在 service。"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import RecordCreate, RecordResponse
from app.services import record_service

router = APIRouter()


@router.post("", response_model=RecordResponse)
async def create_record(
    data: RecordCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await record_service.create_record(db, user.id, data)


@router.get("", response_model=list[RecordResponse])
async def list_records(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await record_service.list_records(db, user.id, skip, limit)


@router.get("/{record_id}", response_model=RecordResponse)
async def get_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await record_service.get_record(db, user.id, record_id)


@router.delete("/{record_id}")
async def delete_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await record_service.delete_record(db, user.id, record_id)
    return {"message": "已删除"}
