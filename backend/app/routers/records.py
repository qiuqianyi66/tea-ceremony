"""品鉴记录 API"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import User, TastingRecord
from app.schemas import RecordCreate, RecordResponse

router = APIRouter()


@router.post("", response_model=RecordResponse)
async def create_record(
    data: RecordCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if data.client_id:
        existing_result = await db.execute(
            select(TastingRecord).filter(
                TastingRecord.user_id == user.id,
                TastingRecord.client_id == data.client_id,
            )
        )
        existing = existing_result.scalar_one_or_none()
        if existing:
            return existing
    record = TastingRecord(**data.model_dump(), user_id=user.id)
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.get("", response_model=list[RecordResponse])
async def list_records(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    limit = min(max(limit, 1), 100)
    stmt = (
        select(TastingRecord)
        .filter(TastingRecord.user_id == user.id)
        .order_by(TastingRecord.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{record_id}", response_model=RecordResponse)
async def get_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TastingRecord).filter(
            TastingRecord.id == record_id,
            TastingRecord.user_id == user.id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@router.delete("/{record_id}")
async def delete_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TastingRecord).filter(
            TastingRecord.id == record_id,
            TastingRecord.user_id == user.id,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    await db.delete(record)
    await db.commit()
    return {"message": "已删除"}
