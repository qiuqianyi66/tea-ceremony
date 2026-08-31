"""品鉴记录 API"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.models import TastingRecord
from app.schemas import RecordCreate, RecordResponse

router = APIRouter()


@router.post("/", response_model=RecordResponse)
def create_record(data: RecordCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    record = TastingRecord(**data.model_dump(), user_id=user.id)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/", response_model=list[RecordResponse])
def list_records(skip: int = 0, limit: int = 50, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    limit = min(max(limit, 1), 100)
    return db.query(TastingRecord).filter(TastingRecord.user_id == user.id).order_by(TastingRecord.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{record_id}", response_model=RecordResponse)
def get_record(record_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    record = db.query(TastingRecord).filter(TastingRecord.id == record_id, TastingRecord.user_id == user.id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@router.delete("/{record_id}")
def delete_record(record_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    record = db.query(TastingRecord).filter(TastingRecord.id == record_id, TastingRecord.user_id == user.id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    db.delete(record)
    db.commit()
    return {"message": "已删除"}
